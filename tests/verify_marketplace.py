"""Run with a Vite dev server at SIESIE_BASE_URL (default http://127.0.0.1:5178)."""
import json
import os
import re
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get("SIESIE_BASE_URL", "http://127.0.0.1:5178")
OUT = ROOT / "docs" / "qa"
OUT.mkdir(parents=True, exist_ok=True)
results = []
errors = []

def record(text):
    results.append(text)
    print(f"PASS {text}", flush=True)

def visit(page, path):
    page.goto(BASE + path)
    page.wait_for_load_state("networkidle")

def as_role(page, role):
    if page.get_by_role("button", name="Switch view").is_visible():
        page.get_by_role("button", name="Switch view").click()
    label = "pro" if role == "Worker" else role.lower()
    page.get_by_role("button", name=f"View prototype as {label}", exact=True).click()
    page.wait_for_load_state("networkidle")

def db(page):
    return page.evaluate("async () => { const data = JSON.parse(localStorage.getItem('siesie.db')); data.session = (await (await fetch('/api/session')).json()).session; return data; }")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1440, "height": 1000})
    page = context.new_page()
    page.on("pageerror", lambda e: errors.append(str(e)))
    visit(page, "/")
    for check in page.evaluate((ROOT / "tests" / "store_contract.js").read_text(encoding="utf-8")):
        record(check)
    visit(page, "/")
    page.screenshot(path=str(OUT / "landing-desktop.png"), full_page=True)
    visit(page, "/search?service=invalid")
    expect(page.get_by_role("heading", name="Workers", exact=True)).to_be_visible()
    record("Invalid search parameter safely falls back to all workers")

    # Complete the customer > worker > customer > admin journey using UI controls.
    visit(page, "/book/w_kwame")
    page.get_by_label("What needs doing?").fill("QA bathroom tiling")
    page.get_by_label("Details", exact=True).fill("Retile the bathroom floor and finish the edges with matching grout.")
    page.get_by_label("Area", exact=True).select_option("East Legon")
    from datetime import date, timedelta
    tomorrow = (date.today() + timedelta(days=2)).isoformat()
    page.get_by_label("Preferred date").fill(tomorrow)
    page.get_by_label("Address or landmark").fill("Sample house by the junction")
    page.get_by_role("button", name="Send request to Kwame").click()
    page.wait_for_url(re.compile(r"/jobs/SS-"))
    booking = page.url.rsplit("/", 1)[-1]
    as_role(page, "Worker")
    visit(page, f"/work/jobs/{booking}")
    expect(page.get_by_text("Sample house by the junction", exact=False)).to_have_count(0)
    page.get_by_role("button", name="Accept and set price").click()
    page.get_by_label("Your price for the whole job").fill("1000")
    page.get_by_role("button", name="Send price to Ama").click()
    expect(page.get_by_text("Accepted · awaiting payment", exact=True)).to_be_visible()
    as_role(page, "Customer")
    visit(page, f"/jobs/{booking}")
    page.get_by_role("button", name=re.compile(r"^Pay GH₵")).click()
    checkout = page.get_by_role("dialog")
    checkout.get_by_role("button", name=re.compile(r"^Pay GH₵")).click()
    checkout.get_by_role("button", name="Decline on phone").click()
    expect(checkout.get_by_text("The payment was declined on the phone.", exact=False)).to_be_visible()
    assert next(j for j in db(page)["jobs"] if j["id"] == booking)["status"] == "quoted"
    checkout.get_by_role("button", name=re.compile(r"^Pay GH₵")).click()
    checkout.get_by_role("button", name="Approve on phone").click()
    expect(checkout.get_by_role("heading", name="Payment held", exact=True)).to_be_visible()
    checkout.get_by_role("button", name="Back to the job").click()
    as_role(page, "Worker")
    visit(page, f"/work/jobs/{booking}")
    expect(page.get_by_text("East Legon, Sample house by the junction", exact=True)).to_be_visible()
    page.get_by_role("button", name="Mark job complete").click()
    page.get_by_label("What did you do?").fill("All tiles laid and grouted. Site cleaned.")
    page.get_by_role("button", name="Mark complete", exact=True).click()
    expect(page.get_by_text("Done · awaiting check", exact=True)).to_be_visible()
    page.screenshot(path=str(OUT / "worker-job-desktop.png"), full_page=True)
    as_role(page, "Customer")
    visit(page, f"/jobs/{booking}")
    page.get_by_role("button", name="Confirm and release payment", exact=True).click()
    page.get_by_role("dialog").get_by_role("button", name=re.compile(r"^Yes, release")).click()
    as_role(page, "Admin")
    visit(page, "/admin/payouts")
    card = page.locator("section").filter(has=page.get_by_role("heading", name="QA bathroom tiling", exact=True))
    card.get_by_role("button", name="Review payout").click()
    page.get_by_role("dialog").get_by_role("button", name="Simulate payout release").click()
    expect(page.get_by_role("heading", name="QA bathroom tiling", exact=True)).to_have_count(0)
    completed = next(j for j in db(page)["jobs"] if j["id"] == booking)
    assert completed["status"] == "closed" and completed["payout"]["status"] == "sent"
    page.reload()
    assert next(j for j in db(page)["jobs"] if j["id"] == booking)["status"] == "closed"
    record("UI booking, quote, declined/retried MoMo payment, completion, confirmation and admin payout survive reload")

    # Exercise the actual dispute decision form and review dialog.
    visit(page, "/admin/disputes/SS-10455")
    page.get_by_label("Decision", exact=True).select_option("split")
    page.get_by_label("Worker allocation before fee (GH₵)").fill("400")
    page.get_by_label("Reason for the decision").fill("Pay for the pipe repair; refund the unfinished ceiling repair.")
    page.get_by_role("button", name="Review decision").click()
    page.get_by_role("dialog").get_by_role("button", name="Record test resolution").click()
    expect(page.get_by_role("heading", name="Decision recorded", exact=True)).to_be_visible()
    visit(page, "/admin/transactions")
    page.get_by_label("Search transactions").fill("SS-10455")
    page.get_by_label("Payment state").select_option("split")
    expect(page.locator("summary")).to_have_count(1)
    page.locator("summary").click()
    expect(page.get_by_role("heading", name="Payment record")).to_be_visible()
    record("UI split decision, transaction filtering and receipt expansion")

    # Registration and verification use generated sample pixels, never personal documents.
    import time
    sample_phone = "024" + str(int(time.time() * 1000))[-7:]
    visit(page, "/join")
    page.get_by_label("Full name", exact=True).fill("QA Sample Worker")
    page.get_by_label("Phone number", exact=True).fill(sample_phone)
    page.locator("label").filter(has=page.get_by_role("checkbox", name="Cleaning", exact=True)).click()
    page.get_by_label("About your work").fill("I offer careful home cleaning and reliable deep cleaning services.")
    page.get_by_label("Base area", exact=True).select_option("East Legon")
    page.get_by_label("Payout phone number").fill("0249876540")
    page.get_by_label("Account holder name").fill("QA Sample Worker")
    page.get_by_label("Ghana Card number").fill("GHA-123456789-0")
    import base64
    sample = {"name":"sample.png","mimeType":"image/png","buffer":base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3foAAAAASUVORK5CYII=")}
    page.get_by_label("Add ID photo", exact=True).set_input_files(sample)
    page.get_by_label("Add portrait", exact=True).set_input_files(sample)
    expect(page.get_by_role("button", name="Remove sample")).to_have_count(2)
    page.get_by_role("button", name="Submit for verification").click()
    page.wait_for_url(BASE + "/work")
    applicant_id = db(page)["session"]["userId"]
    assert next(w for w in db(page)["workers"] if w["id"] == applicant_id)["verification"] == "pending"
    as_role(page, "Admin")
    visit(page, "/admin/verifications")
    application = page.locator("section").filter(has=page.get_by_role("heading", name="QA Sample Worker", exact=True))
    application.get_by_role("button", name="Review application").click()
    page.get_by_role("checkbox", name="I reviewed the submitted documents", exact=False).check()
    page.get_by_role("button", name="Approve worker", exact=True).click()
    visit(page, f"/workers/{applicant_id}")
    expect(page.get_by_role("heading", name="QA Sample Worker", exact=True)).to_be_visible()
    record("UI worker registration, sample photo upload, admin approval and public profile visibility")

    as_role(page, "Worker")
    visit(page, "/work/profile")
    page.get_by_label("About your work").fill("Updated tiling profile with bathroom and kitchen installation experience.")
    page.get_by_role("button", name="Save profile", exact=True).click()
    page.reload()
    expect(page.get_by_label("About your work")).to_have_value("Updated tiling profile with bathroom and kitchen installation experience.")
    record("Worker profile edits persist across reload")

    # Cover every formerly blank screen, desktop and mobile, with layout assertions.
    routes = {
        "Worker": ["/work", "/work/jobs", f"/work/jobs/{booking}", "/work/earnings", "/work/profile"],
        "Admin": ["/admin", "/admin/verifications", "/admin/payouts", "/admin/disputes", "/admin/disputes/SS-10455", "/admin/transactions", "/admin/settings"],
        "Customer": ["/", "/search", "/workers/w_kwame", "/book/w_kwame", "/jobs", f"/jobs/{booking}", "/join", "/login"],
    }
    for width in [1440, 390]:
        page.set_viewport_size({"width":width,"height":1000 if width > 400 else 844})
        for role, paths in routes.items():
            as_role(page, role)
            for path in paths:
                visit(page, path)
                assert page.get_by_role("heading", level=1).count() > 0, f"Missing heading: {path}"
                assert "Unexpected Application Error" not in page.locator("body").inner_text(), path
                overflow = page.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")
                assert not overflow, f"Horizontal overflow at {width}px: {path}"
                if path == "/admin": page.screenshot(path=str(OUT / f"admin-{width}.png"), full_page=True)
                if path == "/work/earnings": page.screenshot(path=str(OUT / f"earnings-{width}.png"), full_page=True)
                if path == "/join" and width == 390: page.screenshot(path=str(OUT / "registration-mobile.png"), full_page=True)
    record("20 routes render without page overflow at desktop and mobile widths")
    assert not errors, "Browser errors: " + json.dumps(errors)
    record("No uncaught browser errors")
    context.close()
    browser.close()

(OUT / "results.json").write_text(json.dumps({"passed":results,"browser_errors":errors},indent=2),encoding="utf-8")
print(f"Completed {len(results)} verification groups.",flush=True)
