import { useEffect } from "react";
import { Link } from "react-router";
import { ArrowLeft, ArrowUp, Calendar, ExternalLink, Lock, MapPin, Shield, UserCheck } from "lucide-react";
import { useTitle } from "../lib/hooks";
import { Tile } from "../components/ui";

const SECTIONS = [
  { id: "infocollect", title: "1. What Information Do We Collect?" },
  { id: "infouse", title: "2. How Do We Process Your Information?" },
  { id: "whoshare", title: "3. When and With Whom Do We Share Your Personal Information?" },
  { id: "inforetain", title: "4. How Long Do We Keep Your Information?" },
  { id: "infosafe", title: "5. How Do We Keep Your Information Safe?" },
  { id: "privacyrights", title: "6. What Are Your Privacy Rights?" },
  { id: "dnt", title: "7. Controls for Do-Not-Track Features" },
  { id: "otherlaws", title: "8. Do Other Regions Have Specific Privacy Rights?" },
  { id: "policyupdates", title: "9. Do We Make Updates to This Notice?" },
  { id: "contact", title: "10. How Can You Contact Us About This Notice?" },
  { id: "request", title: "11. How Can You Review, Update, or Delete the Data We Collect From You?" },
];

export function PrivacyPolicy() {
  useTitle("Privacy Policy · Siesie");

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Breadcrumb / Back Link */}
      <nav aria-label="Breadcrumb" className="mb-6">
        <Link
          to="/"
          className="press inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-ink-soft hover:bg-grout hover:text-ink"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Back to home
        </Link>
      </nav>

      {/* Hero Header */}
      <header className="mb-10">
        <div className="inline-flex items-center gap-2 rounded-full bg-celadon-wash px-3 py-1 text-xs font-extrabold text-emerald-800">
          <Shield className="size-3.5" aria-hidden />
          <span>Your Privacy</span>
        </div>
        <h1 className="display-narrow mt-3 text-3xl text-ink sm:text-4xl lg:text-5xl">Privacy Policy</h1>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-medium text-ink-soft sm:text-sm">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="size-4 text-ink-faint" aria-hidden />
            Last updated: October 16, 2026
          </span>
          <span aria-hidden className="text-grout-deep">·</span>
          <span>Dekiru Company Limited (d/b/a Kirulabs)</span>
          <span aria-hidden className="text-grout-deep">·</span>
          <Link to="/terms" className="font-bold text-cobalt hover:underline">
            View Terms of Service
          </Link>
        </div>
      </header>

      {/* Scope Overview */}
      <Tile className="mb-8 p-6 sm:p-8">
        <p className="text-sm leading-relaxed text-ink-soft">
          This Privacy Notice for <strong>Dekiru Company Limited</strong> (doing business as <strong>Kirulabs</strong>) (&apos;<strong>we</strong>&apos;, &apos;<strong>us</strong>&apos;, or &apos;<strong>our</strong>&apos;), describes how and why we might access, collect, store, use, and/or share (&apos;<strong>process</strong>&apos;) your personal information when you use our services (&apos;<strong>Services</strong>&apos;), including when you:
        </p>

        <ul className="mt-4 list-disc pl-6 space-y-2 text-sm text-ink-soft">
          <li>
            Visit our website at <a href="https://siesie-marketplace.vercel.app" target="_blank" rel="noopener noreferrer" className="font-bold text-cobalt hover:underline">https://siesie-marketplace.vercel.app</a> or any website of ours that links to this Privacy Notice
          </li>
          <li>
            Download and use our mobile application (<strong>Siesie</strong>), or any other application of ours that links to this Privacy Notice
          </li>
          <li>
            Use <strong>Home maintenance booking</strong>. <em>Siesie is a Ghanaian service booking app that makes it easy to find and book trusted service providers for everyday needs. From fitting a light bulb and fixing a leaking sink to cleaning your room, Siesie connects you with the right person to get the job done quickly and conveniently.</em>
          </li>
          <li>Engage with us in other related ways, including any marketing or events</li>
        </ul>

        <div className="mt-6 rounded-2xl border border-slate-100 bg-grout/60 p-4 text-sm text-ink-soft">
          <strong>Questions or concerns?</strong> Reading this Privacy Notice will help you understand your privacy rights and choices. We are responsible for making decisions about how your personal information is processed. If you do not agree with our policies and practices, please do not use our Services. If you still have any questions or concerns, please contact us at <a href="mailto:selasidzeamesi82@gmail.com" className="font-bold text-cobalt hover:underline">selasidzeamesi82@gmail.com</a>.
        </div>
      </Tile>

      {/* Summary of Key Points */}
      <Tile className="mb-8 p-6 sm:p-8">
        <div className="flex items-center gap-2">
          <UserCheck className="size-5 text-cobalt-bright" aria-hidden />
          <h2 className="text-lg font-bold text-ink sm:text-xl">Summary of Key Points</h2>
        </div>
        <p className="mt-2 text-xs italic text-ink-soft sm:text-sm">
          This summary provides key points from our Privacy Notice. You can find out more details about any of these topics by clicking the link following each key point or using our table of contents below.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 text-xs sm:text-sm">
          <div className="rounded-xl border border-slate-100 bg-tile-dim p-4">
            <p className="font-bold text-ink">What personal information do we process?</p>
            <p className="mt-1 text-ink-soft">
              When you visit, use, or navigate our Services, we may process personal information depending on how you interact with us and the Services, the choices you make, and the products and features you use.{" "}
              <a href="#infocollect" className="font-bold text-cobalt hover:underline">Learn more</a>.
            </p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-tile-dim p-4">
            <p className="font-bold text-ink">Do we process sensitive personal information?</p>
            <p className="mt-1 text-ink-soft">
              We do not process sensitive personal information (such as racial or ethnic origins, sexual orientation, or religious beliefs).
            </p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-tile-dim p-4">
            <p className="font-bold text-ink">Do we collect information from third parties?</p>
            <p className="mt-1 text-ink-soft">
              We do not collect any information from third parties.
            </p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-tile-dim p-4">
            <p className="font-bold text-ink">How do we process your information?</p>
            <p className="mt-1 text-ink-soft">
              To provide, improve, and administer our Services, communicate with you, for security and fraud prevention, and to comply with law.{" "}
              <a href="#infouse" className="font-bold text-cobalt hover:underline">Learn more</a>.
            </p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-tile-dim p-4">
            <p className="font-bold text-ink">When and with whom do we share personal information?</p>
            <p className="mt-1 text-ink-soft">
              We may share information in specific situations and with specific third parties (e.g. business transfers, partner offer walls).{" "}
              <a href="#whoshare" className="font-bold text-cobalt hover:underline">Learn more</a>.
            </p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-tile-dim p-4">
            <p className="font-bold text-ink">How do we keep your information safe?</p>
            <p className="mt-1 text-ink-soft">
              We have organizational and technical security measures in place designed to protect your personal information.{" "}
              <a href="#infosafe" className="font-bold text-cobalt hover:underline">Learn more</a>.
            </p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-tile-dim p-4">
            <p className="font-bold text-ink">What are your privacy rights?</p>
            <p className="mt-1 text-ink-soft">
              Depending on where you reside, you have rights regarding your personal information, including review, updates, or deletion.{" "}
              <a href="#privacyrights" className="font-bold text-cobalt hover:underline">Learn more</a>.
            </p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-tile-dim p-4">
            <p className="font-bold text-ink">How do you exercise your rights?</p>
            <p className="mt-1 text-ink-soft">
              The easiest way to exercise your rights is by submitting a{" "}
              <a href="https://app.termly.io/dsar/d5a246f0-d920-4701-ad92-36634ecea277" target="_blank" rel="noopener noreferrer" className="font-bold text-cobalt hover:underline">
                data subject access request
              </a>, or by contacting us.
            </p>
          </div>
        </div>
      </Tile>

      {/* Table of Contents */}
      <nav aria-label="Table of contents" className="mb-10">
        <Tile className="p-6 sm:p-8" as="div">
          <h2 className="text-base font-bold text-ink">Table of Contents</h2>
          <ol className="mt-4 grid gap-2 sm:grid-cols-2 text-xs sm:text-sm">
            {SECTIONS.map((sec) => (
              <li key={sec.id}>
                <a
                  href={`#${sec.id}`}
                  className="press inline-flex items-center rounded-lg px-2 py-1.5 text-ink-mid hover:bg-grout hover:text-cobalt"
                >
                  {sec.title}
                </a>
              </li>
            ))}
          </ol>
        </Tile>
      </nav>

      {/* Full Policy Sections */}
      <article className="space-y-10 text-sm leading-relaxed text-ink-mid">
        {/* Section 1 */}
        <section id="infocollect" className="scroll-mt-24">
          <Tile className="p-6 sm:p-8">
            <h2 className="text-lg font-bold text-ink sm:text-xl">1. WHAT INFORMATION DO WE COLLECT?</h2>
            
            <div className="mt-5 space-y-4">
              <h3 className="font-bold text-ink">Personal information you disclose to us</h3>
              <p className="text-xs italic text-ink-soft sm:text-sm">
                <strong>In Short:</strong> We collect personal information that you provide to us.
              </p>
              <p>
                We collect personal information that you voluntarily provide to us when you register on the Services, express an interest in obtaining information about us or our products and Services, when you participate in activities on the Services, or otherwise when you contact us.
              </p>
              <p>The personal information we collect may include the following:</p>
              <ul className="list-disc pl-6 space-y-1 text-ink-soft">
                <li>names</li>
                <li>phone numbers</li>
                <li>email addresses</li>
                <li>mailing addresses</li>
                <li>job titles</li>
                <li>usernames</li>
                <li>passwords</li>
                <li>contact preferences</li>
                <li>contact or authentication data</li>
                <li>billing addresses</li>
                <li>debit/credit card numbers</li>
              </ul>

              <h4 className="pt-2 font-bold text-ink">Sensitive Information</h4>
              <p>We do not process sensitive information.</p>

              <h4 className="pt-2 font-bold text-ink">Payment Data</h4>
              <p>
                We may collect data necessary to process your payment if you choose to make purchases, such as your payment instrument number, and the security code associated with your payment instrument. All payment data is handled and stored by <strong>Paystack</strong>. You may find their privacy notice here:{" "}
                <a href="https://paystack.com/privacy/merchant#Privacy" target="_blank" rel="noopener noreferrer" className="font-bold text-cobalt hover:underline inline-flex items-center gap-1">
                  https://paystack.com/privacy/merchant#Privacy <ExternalLink className="size-3" aria-hidden />
                </a>.
              </p>

              <h4 className="pt-2 font-bold text-ink">Application Data</h4>
              <p>
                If you use our application(s), we also may collect the following information if you choose to provide us with access or permission:
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-ink-soft">
                <li>
                  <strong>Geolocation Information:</strong> We may request access or permission to track location-based information from your mobile device, either continuously or while you are using our mobile application(s), to provide certain location-based services. If you wish to change our access or permissions, you may do so in your device&apos;s settings.
                </li>
                <li>
                  <strong>Push Notifications:</strong> We may request to send you push notifications regarding your account or certain features of the application(s). If you wish to opt out from receiving these types of communications, you may turn them off in your device&apos;s settings.
                </li>
              </ul>
              <p>
                This information is primarily needed to maintain the security and operation of our application(s), for troubleshooting, and for our internal analytics and reporting purposes.
              </p>
              <p className="font-medium text-ink">
                All personal information that you provide to us must be true, complete, and accurate, and you must notify us of any changes to such personal information.
              </p>

              <h3 className="pt-4 font-bold text-ink">Information automatically collected</h3>
              <p className="text-xs italic text-ink-soft sm:text-sm">
                <strong>In Short:</strong> Some information — such as your Internet Protocol (IP) address and/or browser and device characteristics — is collected automatically when you visit our Services.
              </p>
              <p>
                We automatically collect certain information when you visit, use, or navigate the Services. This information does not reveal your specific identity (like your name or contact information) but may include device and usage information, such as your IP address, browser and device characteristics, operating system, language preferences, referring URLs, device name, country, location, information about how and when you use our Services, and other technical information. This information is primarily needed to maintain the security and operation of our Services, and for our internal analytics and reporting purposes.
              </p>
              <p>The information we collect includes:</p>
              <ul className="list-disc pl-6 space-y-2 text-ink-soft">
                <li>
                  <strong>Log and Usage Data:</strong> Service-related, diagnostic, usage, and performance information our servers automatically collect when you access or use our Services and which we record in log files. This may include IP address, browser type and settings, date/time stamps, searches, and device event information.
                </li>
                <li>
                  <strong>Device Data:</strong> Information about your computer, phone, tablet, or other device you use to access the Services, such as IP address, device application IDs, location, browser type, hardware model, operating system, and system configurations.
                </li>
                <li>
                  <strong>Location Data:</strong> Information about your device&apos;s location (precise or imprecise via IP address or GPS). You can opt out by refusing access or disabling Location settings on your device.
                </li>
              </ul>
            </div>
          </Tile>
        </section>

        {/* Section 2 */}
        <section id="infouse" className="scroll-mt-24">
          <Tile className="p-6 sm:p-8">
            <h2 className="text-lg font-bold text-ink sm:text-xl">2. HOW DO WE PROCESS YOUR INFORMATION?</h2>
            <p className="mt-3 text-xs italic text-ink-soft sm:text-sm">
              <strong>In Short:</strong> We process your information to provide, improve, and administer our Services, communicate with you, for security and fraud prevention, and to comply with law. We may also process your information for other purposes with your consent.
            </p>
            <div className="mt-5 space-y-3">
              <p>We process your personal information for a variety of reasons, depending on how you interact with our Services, including:</p>
              <ul className="list-disc pl-6 space-y-2 text-ink-soft">
                <li><strong>To facilitate account creation and authentication and otherwise manage user accounts:</strong> We may process your information so you can create and log in to your account, as well as keep your account in working order.</li>
                <li><strong>To deliver and facilitate delivery of services to the user:</strong> We may process your information to provide you with the requested service.</li>
                <li><strong>To respond to user inquiries/offer support to users:</strong> We may process your information to respond to your inquiries and solve any potential issues you might have with the requested service.</li>
                <li><strong>To send administrative information to you:</strong> Details about our products and services, changes to our terms and policies, and other similar operational information.</li>
                <li><strong>To request feedback:</strong> Contacting you about your use of our Services.</li>
                <li><strong>To send you marketing and promotional communications:</strong> In accordance with your marketing preferences. You can opt out at any time.</li>
                <li><strong>To deliver targeted advertising to you:</strong> Developing and displaying personalised content and advertising tailored to your interests and location.</li>
                <li><strong>To protect our Services:</strong> Keeping our Services safe and secure, including fraud monitoring and prevention.</li>
                <li><strong>To evaluate and improve our Services, products, marketing, and your experience:</strong> Identifying usage trends and determining promotional campaign effectiveness.</li>
                <li><strong>To identify usage trends:</strong> Understanding how Services are used so we can improve features and reliability.</li>
              </ul>
            </div>
          </Tile>
        </section>

        {/* Section 3 */}
        <section id="whoshare" className="scroll-mt-24">
          <Tile className="p-6 sm:p-8">
            <h2 className="text-lg font-bold text-ink sm:text-xl">3. WHEN AND WITH WHOM DO WE SHARE YOUR PERSONAL INFORMATION?</h2>
            <p className="mt-3 text-xs italic text-ink-soft sm:text-sm">
              <strong>In Short:</strong> We may share information in specific situations described in this section and/or with specific third parties.
            </p>
            <div className="mt-5 space-y-3">
              <p>We may need to share your personal information in the following situations:</p>
              <ul className="list-disc pl-6 space-y-2 text-ink-soft">
                <li>
                  <strong>Business Transfers:</strong> We may share or transfer your information in connection with, or during negotiations of, any merger, sale of company assets, financing, or acquisition of all or a portion of our business to another company.
                </li>
                <li>
                  <strong>Offer Wall:</strong> Our application(s) may display a third-party hosted &apos;offer wall&apos;. Such an offer wall allows third-party advertisers to offer virtual rewards to users. A unique identifier (such as your user ID) will be shared with the offer wall provider in order to prevent fraud and properly credit your account.
                </li>
              </ul>
            </div>
          </Tile>
        </section>

        {/* Section 4 */}
        <section id="inforetain" className="scroll-mt-24">
          <Tile className="p-6 sm:p-8">
            <h2 className="text-lg font-bold text-ink sm:text-xl">4. HOW LONG DO WE KEEP YOUR INFORMATION?</h2>
            <p className="mt-3 text-xs italic text-ink-soft sm:text-sm">
              <strong>In Short:</strong> We keep your information for as long as necessary to fulfil the purposes outlined in this Privacy Notice unless otherwise required by law.
            </p>
            <div className="mt-5 space-y-3">
              <p>
                We will only keep your personal information for as long as it is necessary for the purposes set out in this Privacy Notice, unless a longer retention period is required or permitted by law (such as tax, accounting, or other legal requirements). No purpose in this notice will require us keeping your personal information for longer than <strong>the period of time in which users have an account with us</strong>.
              </p>
              <p>
                When we have no ongoing legitimate business need to process your personal information, we will either delete or anonymise such information, or, if this is not possible (for example, because your personal information has been stored in backup archives), then we will securely store your personal information and isolate it from any further processing until deletion is possible.
              </p>
            </div>
          </Tile>
        </section>

        {/* Section 5 */}
        <section id="infosafe" className="scroll-mt-24">
          <Tile className="p-6 sm:p-8">
            <h2 className="text-lg font-bold text-ink sm:text-xl">5. HOW DO WE KEEP YOUR INFORMATION SAFE?</h2>
            <p className="mt-3 text-xs italic text-ink-soft sm:text-sm">
              <strong>In Short:</strong> We aim to protect your personal information through a system of organisational and technical security measures.
            </p>
            <div className="mt-5 space-y-3">
              <p>
                We have implemented appropriate and reasonable technical and organisational security measures designed to protect the security of any personal information we process. However, despite our safeguards and efforts to secure your information, no electronic transmission over the Internet or information storage technology can be guaranteed to be 100% secure, so we cannot promise or guarantee that hackers, cybercriminals, or other unauthorised third parties will not be able to defeat our security and improperly collect, access, steal, or modify your information.
              </p>
              <p>
                Although we will do our best to protect your personal information, transmission of personal information to and from our Services is at your own risk. You should only access the Services within a secure environment.
              </p>
            </div>
          </Tile>
        </section>

        {/* Section 6 */}
        <section id="privacyrights" className="scroll-mt-24">
          <Tile className="p-6 sm:p-8">
            <h2 className="text-lg font-bold text-ink sm:text-xl">6. WHAT ARE YOUR PRIVACY RIGHTS?</h2>
            <p className="mt-3 text-xs italic text-ink-soft sm:text-sm">
              <strong>In Short:</strong> You may review, change, or terminate your account at any time, depending on your country, province, or state of residence.
            </p>
            <div className="mt-5 space-y-4">
              <h3 className="font-bold text-ink">Withdrawing your consent</h3>
              <p>
                If we are relying on your consent to process your personal information, which may be express and/or implied consent depending on the applicable law, you have the right to withdraw your consent at any time. You can withdraw your consent at any time by contacting us using the contact details provided in the contact section below.
              </p>
              <p>
                However, please note that this will not affect the lawfulness of the processing before its withdrawal nor, when applicable law allows, will it affect the processing of your personal information conducted in reliance on lawful processing grounds other than consent.
              </p>

              <h3 className="pt-2 font-bold text-ink">Opting out of marketing and promotional communications</h3>
              <p>
                You can unsubscribe from our marketing and promotional communications at any time by clicking on the unsubscribe link in the emails that we send, or by contacting us. You will then be removed from the marketing lists. However, we may still communicate with you — for example, to send you service-related messages that are necessary for the administration and use of your account, to respond to service requests, or for other non-marketing purposes.
              </p>

              <h3 className="pt-2 font-bold text-ink">Account Information</h3>
              <p>If you would at any time like to review or change the information in your account or terminate your account, you can:</p>
              <ul className="list-disc pl-6 space-y-1 text-ink-soft">
                <li>Log in to your account settings and update your user account.</li>
                <li>Contact us using the contact information provided below.</li>
              </ul>
              <p>
                Upon your request to terminate your account, we will deactivate or delete your account and information from our active databases. However, we may retain some information in our files to prevent fraud, troubleshoot problems, assist with any investigations, enforce our legal terms and/or comply with applicable legal requirements.
              </p>
              <p>
                If you have questions or comments about your privacy rights, you may email us at <a href="mailto:selasidzeamesi82@gmail.com" className="font-bold text-cobalt hover:underline">selasidzeamesi82@gmail.com</a>.
              </p>
            </div>
          </Tile>
        </section>

        {/* Section 7 */}
        <section id="dnt" className="scroll-mt-24">
          <Tile className="p-6 sm:p-8">
            <h2 className="text-lg font-bold text-ink sm:text-xl">7. CONTROLS FOR DO-NOT-TRACK FEATURES</h2>
            <div className="mt-4 space-y-3">
              <p>
                Most web browsers and some mobile operating systems and mobile applications include a Do-Not-Track (&apos;DNT&apos;) feature or setting you can activate to signal your privacy preference not to have data about your online browsing activities monitored and collected. At this stage, no uniform technology standard for recognising and implementing DNT signals has been finalised. As such, we do not currently respond to DNT browser signals or any other mechanism that automatically communicates your choice not to be tracked online. If a standard for online tracking is adopted that we must follow in the future, we will inform you about that practice in a revised version of this Privacy Notice.
              </p>
            </div>
          </Tile>
        </section>

        {/* Section 8 */}
        <section id="otherlaws" className="scroll-mt-24">
          <Tile className="p-6 sm:p-8">
            <h2 className="text-lg font-bold text-ink sm:text-xl">8. DO OTHER REGIONS HAVE SPECIFIC PRIVACY RIGHTS?</h2>
            <p className="mt-3 text-xs italic text-ink-soft sm:text-sm">
              <strong>In Short:</strong> You may have additional rights based on the country you reside in.
            </p>
            <div className="mt-5 space-y-4">
              <h3 className="font-bold text-ink">Australia</h3>
              <p>
                We collect and process your personal information under the obligations and conditions set by <strong>Australia&apos;s Privacy Act 1988</strong> (Privacy Act). This Privacy Notice satisfies the notice requirements defined in the Privacy Act, in particular: what personal information we collect from you, from which sources, for which purposes, and other recipients of your personal information.
              </p>
              <p>If you do not wish to provide the personal information necessary to fulfil their applicable purpose, it may affect our ability to provide our services, in particular:</p>
              <ul className="list-disc pl-6 space-y-1 text-ink-soft">
                <li>offer you the products or services that you want</li>
                <li>respond to or help with your requests</li>
                <li>manage your account with us</li>
                <li>confirm your identity and protect your account</li>
              </ul>
              <p>
                If you believe we are unlawfully processing your personal information, you have the right to submit a complaint about a breach of the Australian Privacy Principles to the{" "}
                <a href="https://www.oaic.gov.au/privacy/privacy-complaints/lodge-a-privacy-complaint-with-us" target="_blank" rel="noopener noreferrer" className="font-bold text-cobalt hover:underline inline-flex items-center gap-1">
                  Office of the Australian Information Commissioner <ExternalLink className="size-3" aria-hidden />
                </a>.
              </p>

              <h3 className="pt-2 font-bold text-ink">Republic of South Africa</h3>
              <p>
                At any time, you have the right to request access to or correction of your personal information. You can make such a request by contacting us. If you are unsatisfied with the manner in which we address any complaint with regard to our processing of personal information, you can contact the office of the regulator:
              </p>
              <div className="rounded-xl border border-slate-100 bg-grout/60 p-4 text-xs sm:text-sm text-ink-soft space-y-1">
                <p className="font-bold text-ink">
                  <a href="https://inforegulator.org.za/" target="_blank" rel="noopener noreferrer" className="text-cobalt hover:underline">
                    The Information Regulator (South Africa)
                  </a>
                </p>
                <p>General enquiries: <a href="mailto:enquiries@inforegulator.org.za" className="text-cobalt hover:underline">enquiries@inforegulator.org.za</a></p>
                <p>
                  Complaints (complete POPIA/PAIA form 5): <a href="mailto:PAIAComplaints@inforegulator.org.za" className="text-cobalt hover:underline">PAIAComplaints@inforegulator.org.za</a> &amp; <a href="mailto:POPIAComplaints@inforegulator.org.za" className="text-cobalt hover:underline">POPIAComplaints@inforegulator.org.za</a>
                </p>
              </div>
            </div>
          </Tile>
        </section>

        {/* Section 9 */}
        <section id="policyupdates" className="scroll-mt-24">
          <Tile className="p-6 sm:p-8">
            <h2 className="text-lg font-bold text-ink sm:text-xl">9. DO WE MAKE UPDATES TO THIS NOTICE?</h2>
            <p className="mt-3 text-xs italic text-ink-soft sm:text-sm">
              <strong>In Short:</strong> Yes, we will update this notice as necessary to stay compliant with relevant laws.
            </p>
            <div className="mt-5 space-y-3">
              <p>
                We may update this Privacy Notice from time to time. The updated version will be indicated by an updated &apos;Revised&apos; date at the top of this Privacy Notice. If we make material changes to this Privacy Notice, we may notify you either by prominently posting a notice of such changes or by directly sending you a notification. We encourage you to review this Privacy Notice frequently to be informed of how we are protecting your information.
              </p>
            </div>
          </Tile>
        </section>

        {/* Section 10 */}
        <section id="contact" className="scroll-mt-24">
          <Tile className="p-6 sm:p-8">
            <h2 className="text-lg font-bold text-ink sm:text-xl">10. HOW CAN YOU CONTACT US ABOUT THIS NOTICE?</h2>
            <div className="mt-4 space-y-3">
              <p>
                If you have questions or comments about this notice, you may email us at{" "}
                <a href="mailto:kirulabsofficial@gmail.com" className="font-bold text-cobalt hover:underline">
                  kirulabsofficial@gmail.com
                </a>{" "}
                or contact us by post at:
              </p>

              <div className="mt-4 flex items-start gap-3 rounded-2xl border border-slate-100 bg-grout/60 p-4">
                <MapPin className="size-5 shrink-0 text-cobalt-bright mt-0.5" aria-hidden />
                <div className="text-xs sm:text-sm text-ink-soft">
                  <p className="font-bold text-ink">Dekiru Company Limited</p>
                  <p>Nii Amateifio Street, Tantra hills</p>
                  <p>Accra, GA 30127</p>
                  <p>Ghana</p>
                </div>
              </div>
            </div>
          </Tile>
        </section>

        {/* Section 11 */}
        <section id="request" className="scroll-mt-24">
          <Tile className="p-6 sm:p-8">
            <h2 className="text-lg font-bold text-ink sm:text-xl">11. HOW CAN YOU REVIEW, UPDATE, OR DELETE THE DATA WE COLLECT FROM YOU?</h2>
            <div className="mt-4 space-y-4">
              <p>
                Based on the applicable laws of your country, you may have the right to request access to the personal information we collect from you, details about how we have processed it, correct inaccuracies, or delete your personal information. You may also have the right to withdraw your consent to our processing of your personal information. These rights may be limited in some circumstances by applicable law.
              </p>
              <p>
                To request to review, update, or delete your personal information, please submit a request using our data access form:
              </p>
              <div>
                <a
                  href="https://app.termly.io/dsar/d5a246f0-d920-4701-ad92-36634ecea277"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="press inline-flex items-center gap-2 rounded-2xl bg-cobalt-bright px-5 py-3 text-sm font-bold text-white shadow-[var(--shadow-cobalt)] hover:bg-cobalt"
                >
                  <Lock className="size-4" aria-hidden />
                  Submit Data Subject Access Request
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              </div>

              <p className="mt-6 text-xs text-ink-faint">
                This Privacy Policy was created using Termly&apos;s Privacy Policy Generator.
              </p>
            </div>
          </Tile>
        </section>
      </article>

      {/* Floating Back to Top Button */}
      <div className="mt-12 flex items-center justify-between border-t border-grout pt-6">
        <Link to="/terms" className="text-xs font-bold text-cobalt hover:underline sm:text-sm">
          ← Review Terms of Service
        </Link>
        <button
          type="button"
          onClick={scrollToTop}
          className="press inline-flex items-center gap-1.5 rounded-full border border-grout-deep bg-white px-4 py-2 text-xs font-bold text-ink-mid shadow-[var(--shadow-flush)] hover:bg-tile-dim"
        >
          <ArrowUp className="size-3.5" aria-hidden />
          Back to top
        </button>
      </div>
    </div>
  );
}
