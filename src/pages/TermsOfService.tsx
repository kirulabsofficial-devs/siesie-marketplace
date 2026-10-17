import { useEffect } from "react";
import { Link } from "react-router";
import { ArrowLeft, ArrowUp, Calendar, FileText, Mail, MapPin, Phone } from "lucide-react";
import { useTitle } from "../lib/hooks";
import { Tile } from "../components/ui";

const SECTIONS = [
  { id: "services", title: "1. Our Services" },
  { id: "ip", title: "2. Intellectual Property Rights" },
  { id: "representations", title: "3. User Representations" },
  { id: "registration", title: "4. User Registration" },
  { id: "purchases", title: "5. Purchases and Payment" },
  { id: "subscriptions", title: "6. Subscriptions" },
  { id: "prohibited", title: "7. Prohibited Activities" },
  { id: "contributions", title: "8. User Generated Contributions" },
  { id: "licence", title: "9. Contribution Licence" },
  { id: "reviews", title: "10. Guidelines for Reviews" },
  { id: "mobile-licence", title: "11. Mobile Application Licence" },
  { id: "management", title: "12. Services Management" },
  { id: "termination", title: "13. Term and Termination" },
  { id: "modifications", title: "14. Modifications and Interruptions" },
  { id: "governing-law", title: "15. Governing Law" },
  { id: "disputes", title: "16. Dispute Resolution" },
  { id: "corrections", title: "17. Corrections" },
  { id: "disclaimer", title: "18. Disclaimer" },
  { id: "liability", title: "19. Limitations of Liability" },
  { id: "indemnification", title: "20. Indemnification" },
  { id: "user-data", title: "21. User Data" },
  { id: "electronic", title: "22. Electronic Communications, Transactions, and Signatures" },
  { id: "miscellaneous", title: "23. Miscellaneous" },
  { id: "contact", title: "24. Contact Us" },
];

export function TermsOfService() {
  useTitle("Terms of Service · Siesie");

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
        <div className="inline-flex items-center gap-2 rounded-full bg-cobalt-wash px-3 py-1 text-xs font-extrabold text-cobalt">
          <FileText className="size-3.5" aria-hidden />
          <span>Legal Agreement</span>
        </div>
        <h1 className="display-narrow mt-3 text-3xl text-ink sm:text-4xl lg:text-5xl">Terms of Service</h1>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-medium text-ink-soft sm:text-sm">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="size-4 text-ink-faint" aria-hidden />
            Last updated: October 16, 2026
          </span>
          <span aria-hidden className="text-grout-deep">·</span>
          <span>Dekiru Company Limited (d/b/a Kirulabs)</span>
          <span aria-hidden className="text-grout-deep">·</span>
          <Link to="/privacy" className="font-bold text-cobalt hover:underline">
            View Privacy Policy
          </Link>
        </div>
      </header>

      {/* Intro Summary Tile */}
      <Tile className="mb-8 p-6 sm:p-8">
        <h2 className="text-lg font-bold text-ink sm:text-xl">Agreement to Our Legal Terms</h2>
        <div className="mt-4 space-y-4 text-sm leading-relaxed text-ink-soft">
          <p>
            We are <strong>Dekiru Company Limited</strong>, doing business as <strong>Kirulabs</strong> (&apos;Company&apos;, &apos;we&apos;, &apos;us&apos;, or &apos;our&apos;).
          </p>
          <p>
            We operate the website <a href="https://siesie-marketplace.vercel.app" target="_blank" rel="noopener noreferrer" className="font-bold text-cobalt hover:underline">https://siesie-marketplace.vercel.app</a> (the &apos;Site&apos;), the mobile application <strong>Siesie</strong> (the &apos;App&apos;), as well as any other related products and services that refer or link to these legal terms (the &apos;Legal Terms&apos;) (collectively, the &apos;Services&apos;).
          </p>
          <p className="rounded-2xl border border-cobalt-wash bg-cobalt-wash/40 p-4 text-ink">
            <strong>Siesie</strong> is a Ghanaian service booking app that makes it easy to find and book trusted service providers for everyday needs. From fitting a light bulb and fixing a leaking sink to cleaning your room, Siesie connects you with the right person to get the job done quickly and conveniently. <em>Siesie. Your services, made simple.</em>
          </p>
          <p>
            You can contact us by phone at <a href="tel:+233547601618" className="font-bold text-cobalt hover:underline">(+233) 54 760 1618</a>, email at <a href="mailto:kirulabsofficial@gmail.com" className="font-bold text-cobalt hover:underline">kirulabsofficial@gmail.com</a>, or by mail to <strong>Kirulabs, 21 opeabere avenue, Accra, Greater Accra 233, Ghana</strong>.
          </p>
          <p>
            These Legal Terms constitute a legally binding agreement made between you, whether personally or on behalf of an entity (&apos;you&apos;), and Dekiru Company Limited, concerning your access to and use of the Services. You agree that by accessing the Services, you have read, understood, and agreed to be bound by all of these Legal Terms. <strong>IF YOU DO NOT AGREE WITH ALL OF THESE LEGAL TERMS, THEN YOU ARE EXPRESSLY PROHIBITED FROM USING THE SERVICES AND YOU MUST DISCONTINUE USE IMMEDIATELY.</strong>
          </p>
          <p>
            We will provide you with prior notice of any scheduled changes to the Services you are using. The modified Legal Terms will become effective upon posting or notifying you by <a href="mailto:kirulabsofficial@gmail.com" className="text-cobalt hover:underline">kirulabsofficial@gmail.com</a>, as stated in the email message. By continuing to use the Services after the effective date of any changes, you agree to be bound by the modified terms.
          </p>
          <p>
            The Services are intended for users who are at least 13 years of age. All users who are minors in the jurisdiction in which they reside (generally under the age of 18) must have the permission of, and be directly supervised by, their parent or guardian to use the Services. If you are a minor, you must have your parent or guardian read and agree to these Legal Terms prior to you using the Services.
          </p>
          <p className="font-medium text-ink-mid">
            We recommend that you print or save a copy of these Legal Terms for your records.
          </p>
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

      {/* Full Legal Text Sections */}
      <article className="space-y-10 text-sm leading-relaxed text-ink-mid">
        {/* Section 1 */}
        <section id="services" className="scroll-mt-24">
          <Tile className="p-6 sm:p-8">
            <h2 className="text-lg font-bold text-ink sm:text-xl">1. OUR SERVICES</h2>
            <div className="mt-4 space-y-3">
              <p>
                The information provided when using the Services is not intended for distribution to or use by any person or entity in any jurisdiction or country where such distribution or use would be contrary to law or regulation or which would subject us to any registration requirement within such jurisdiction or country. Accordingly, those persons who choose to access the Services from other locations do so on their own initiative and are solely responsible for compliance with local laws, if and to the extent local laws are applicable.
              </p>
            </div>
          </Tile>
        </section>

        {/* Section 2 */}
        <section id="ip" className="scroll-mt-24">
          <Tile className="p-6 sm:p-8">
            <h2 className="text-lg font-bold text-ink sm:text-xl">2. INTELLECTUAL PROPERTY RIGHTS</h2>
            <div className="mt-4 space-y-4">
              <h3 className="font-bold text-ink">Our intellectual property</h3>
              <p>
                We are the owner or the licensee of all intellectual property rights in our Services, including all source code, databases, functionality, software, website designs, audio, video, text, photographs, and graphics in the Services (collectively, the &apos;Content&apos;), as well as the trademarks, service marks, and logos contained therein (the &apos;Marks&apos;).
              </p>
              <p>
                Our Content and Marks are protected by copyright and trademark laws (and various other intellectual property rights and unfair competition laws) and treaties around the world.
              </p>
              <p>
                The Content and Marks are provided in or through the Services &apos;AS IS&apos; for your personal, non-commercial use or internal business purpose only.
              </p>

              <h3 className="pt-2 font-bold text-ink">Your use of our Services</h3>
              <p>
                Subject to your compliance with these Legal Terms, including the &apos;PROHIBITED ACTIVITIES&apos; section below, we grant you a non-exclusive, non-transferable, revocable licence to:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-ink-soft">
                <li>access the Services; and</li>
                <li>download or print a copy of any portion of the Content to which you have properly gained access,</li>
              </ul>
              <p>solely for your personal, non-commercial use or internal business purpose.</p>
              <p>
                Except as set out in this section or elsewhere in our Legal Terms, no part of the Services and no Content or Marks may be copied, reproduced, aggregated, republished, uploaded, posted, publicly displayed, encoded, translated, transmitted, distributed, sold, licensed, or otherwise exploited for any commercial purpose whatsoever, without our express prior written permission.
              </p>
              <p>
                If you wish to make any use of the Services, Content, or Marks other than as set out in this section or elsewhere in our Legal Terms, please address your request to: <a href="mailto:kirulabsofficial@gmail.com" className="font-bold text-cobalt hover:underline">kirulabsofficial@gmail.com</a>. If we ever grant you the permission to post, reproduce, or publicly display any part of our Services or Content, you must identify us as the owners or licensors of the Services, Content, or Marks and ensure that any copyright or proprietary notice appears or is visible on posting, reproducing, or displaying our Content.
              </p>
              <p>
                We reserve all rights not expressly granted to you in and to the Services, Content, and Marks.
              </p>
              <p>
                Any breach of these Intellectual Property Rights will constitute a material breach of our Legal Terms and your right to use our Services will terminate immediately.
              </p>

              <h3 className="pt-2 font-bold text-ink">Your submissions and contributions</h3>
              <p>
                Please review this section and the &apos;PROHIBITED ACTIVITIES&apos; section carefully prior to using our Services to understand the (a) rights you give us and (b) obligations you have when you post or upload any content through the Services.
              </p>
              <p>
                <strong>Submissions:</strong> By directly sending us any question, comment, suggestion, idea, feedback, or other information about the Services (&apos;Submissions&apos;), you agree to assign to us all intellectual property rights in such Submission. You agree that we shall own this Submission and be entitled to its unrestricted use and dissemination for any lawful purpose, commercial or otherwise, without acknowledgment or compensation to you.
              </p>
              <p>
                <strong>Contributions:</strong> The Services may invite you to chat, contribute to, or participate in blogs, message boards, online forums, and other functionality during which you may create, submit, post, display, transmit, publish, distribute, or broadcast content and materials to us or through the Services, including but not limited to text, writings, video, audio, photographs, music, graphics, comments, reviews, rating suggestions, personal information, or other material (&apos;Contributions&apos;). Any Submission that is publicly posted shall also be treated as a Contribution.
              </p>
              <p>
                You understand that Contributions may be viewable by other users of the Services.
              </p>
              <p>
                <strong>When you post Contributions, you grant us a licence (including use of your name, trademarks, and logos):</strong> By posting any Contributions, you grant us an unrestricted, unlimited, irrevocable, perpetual, non-exclusive, transferable, royalty-free, fully-paid, worldwide right, and licence to: use, copy, reproduce, distribute, sell, resell, publish, broadcast, retitle, store, publicly perform, publicly display, reformat, translate, excerpt (in whole or in part), and exploit your Contributions (including, without limitation, your image, name, and voice) for any purpose, commercial, advertising, or otherwise, to prepare derivative works of, or incorporate into other works, your Contributions, and to sublicence the licences granted in this section. Our use and distribution may occur in any media formats and through any media channels.
              </p>
              <p>
                This licence includes our use of your name, company name, and franchise name, as applicable, and any of the trademarks, service marks, trade names, logos, and personal and commercial images you provide.
              </p>
              <p>
                <strong>You are responsible for what you post or upload:</strong> By sending us Submissions and/or posting Contributions through any part of the Services or making Contributions accessible through the Services by linking your account through the Services to any of your social networking accounts, you:
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-ink-soft">
                <li>confirm that you have read and agree with our &apos;PROHIBITED ACTIVITIES&apos; and will not post, send, publish, upload, or transmit through the Services any Submission nor post any Contribution that is illegal, harassing, hateful, harmful, defamatory, obscene, bullying, abusive, discriminatory, threatening to any person or group, sexually explicit, false, inaccurate, deceitful, or misleading;</li>
                <li>to the extent permissible by applicable law, waive any and all moral rights to any such Submission and/or Contribution;</li>
                <li>warrant that any such Submission and/or Contributions are original to you or that you have the necessary rights and licences to submit such Submissions and/or Contributions and that you have full authority to grant us the above-mentioned rights in relation to your Submissions and/or Contributions; and</li>
                <li>warrant and represent that your Submissions and/or Contributions do not constitute confidential information.</li>
              </ul>
              <p>
                You are solely responsible for your Submissions and/or Contributions and you expressly agree to reimburse us for any and all losses that we may suffer because of your breach of (a) this section, (b) any third party&apos;s intellectual property rights, or (c) applicable law.
              </p>
              <p>
                <strong>We may remove or edit your Content:</strong> Although we have no obligation to monitor any Contributions, we shall have the right to remove or edit any Contributions at any time without notice if in our reasonable opinion we consider such Contributions harmful or in breach of these Legal Terms. If we remove or edit any such Contributions, we may also suspend or disable your account and report you to the authorities.
              </p>
            </div>
          </Tile>
        </section>

        {/* Section 3 */}
        <section id="representations" className="scroll-mt-24">
          <Tile className="p-6 sm:p-8">
            <h2 className="text-lg font-bold text-ink sm:text-xl">3. USER REPRESENTATIONS</h2>
            <div className="mt-4 space-y-3">
              <p>
                By using the Services, you represent and warrant that: (1) all registration information you submit will be true, accurate, current, and complete; (2) you will maintain the accuracy of such information and promptly update such registration information as necessary; (3) you have the legal capacity and you agree to comply with these Legal Terms; (4) you are not under the age of 13; (5) you are not a minor in the jurisdiction in which you reside, or if a minor, you have received parental permission to use the Services; (6) you will not access the Services through automated or non-human means, whether through a bot, script or otherwise; (7) you will not use the Services for any illegal or unauthorised purpose; and (8) your use of the Services will not violate any applicable law or regulation.
              </p>
              <p>
                If you provide any information that is untrue, inaccurate, not current, or incomplete, we have the right to suspend or terminate your account and refuse any and all current or future use of the Services (or any portion thereof).
              </p>
            </div>
          </Tile>
        </section>

        {/* Section 4 */}
        <section id="registration" className="scroll-mt-24">
          <Tile className="p-6 sm:p-8">
            <h2 className="text-lg font-bold text-ink sm:text-xl">4. USER REGISTRATION</h2>
            <div className="mt-4 space-y-3">
              <p>
                You may be required to register to use the Services. You agree to keep your password or access code confidential and will be responsible for all use of your account and password. We reserve the right to remove, reclaim, or change a username you select if we determine, in our sole discretion, that such username is inappropriate, obscene, or otherwise objectionable.
              </p>
            </div>
          </Tile>
        </section>

        {/* Section 5 */}
        <section id="purchases" className="scroll-mt-24">
          <Tile className="p-6 sm:p-8">
            <h2 className="text-lg font-bold text-ink sm:text-xl">5. PURCHASES AND PAYMENT</h2>
            <div className="mt-4 space-y-3">
              <p>We accept the following forms of payment:</p>
              <ul className="list-disc pl-6 space-y-1 text-ink-soft">
                <li>Mastercard</li>
                <li>American Express</li>
                <li>Discover</li>
                <li>Mobile Money (MTN MoMo, Telecel Cash, AirtelTigo Money via Paystack)</li>
              </ul>
              <p>
                You agree to provide current, complete, and accurate purchase and account information for all purchases made via the Services. You further agree to promptly update account and payment information, including email address, payment method, and payment card expiration date, so that we can complete your transactions and contact you as needed. Sales tax will be added to the price of purchases as deemed required by us. We may change prices at any time. All payments shall be in <strong>Cedis (GH₵)</strong>.
              </p>
              <p>
                You agree to pay all charges at the prices then in effect for your purchases and any applicable fees, and you authorise us to charge your chosen payment provider for any such amounts upon placing your order. We reserve the right to correct any errors or mistakes in pricing, even if we have already requested or received payment.
              </p>
              <p>
                We reserve the right to refuse any order placed through the Services. We may, in our sole discretion, limit or cancel quantities purchased per person, per household, or per order. These restrictions may include orders placed by or under the same customer account, the same payment method, and/or orders that use the same billing or shipping address. We reserve the right to limit or prohibit orders that, in our sole judgement, appear to be placed by dealers, resellers, or distributors.
              </p>
            </div>
          </Tile>
        </section>

        {/* Section 6 */}
        <section id="subscriptions" className="scroll-mt-24">
          <Tile className="p-6 sm:p-8">
            <h2 className="text-lg font-bold text-ink sm:text-xl">6. SUBSCRIPTIONS</h2>
            <div className="mt-4 space-y-3">
              <h3 className="font-bold text-ink">Billing and Renewal</h3>
              <p>
                Your subscription will continue and automatically renew unless cancelled. You consent to our charging your payment method on a recurring basis without requiring your prior approval for each recurring charge, until such time as you cancel the applicable order. The length of your billing cycle will depend on the type of subscription plan you choose when you subscribed to the Services.
              </p>
              <h3 className="pt-2 font-bold text-ink">Cancellation</h3>
              <p>
                All purchases are non-refundable. You can cancel your subscription at any time by contacting us using the contact information provided below. Your cancellation will take effect at the end of the current paid term. If you have any questions or are unsatisfied with our Services, please email us at <a href="mailto:kirulabsofficial@gmail.com" className="font-bold text-cobalt hover:underline">kirulabsofficial@gmail.com</a>.
              </p>
              <h3 className="pt-2 font-bold text-ink">Fee Changes</h3>
              <p>
                We may, from time to time, make changes to the subscription fee and will communicate any price changes to you in accordance with applicable law.
              </p>
            </div>
          </Tile>
        </section>

        {/* Section 7 */}
        <section id="prohibited" className="scroll-mt-24">
          <Tile className="p-6 sm:p-8">
            <h2 className="text-lg font-bold text-ink sm:text-xl">7. PROHIBITED ACTIVITIES</h2>
            <div className="mt-4 space-y-3">
              <p>
                You may not access or use the Services for any purpose other than that for which we make the Services available. The Services may not be used in connection with any commercial endeavours except those that are specifically endorsed or approved by us.
              </p>
              <p>As a user of the Services, you agree not to:</p>
              <ul className="list-disc pl-6 space-y-2 text-ink-soft">
                <li>Systematically retrieve data or other content from the Services to create or compile, directly or indirectly, a collection, compilation, database, or directory without written permission from us.</li>
                <li>Trick, defraud, or mislead us and other users, especially in any attempt to learn sensitive account information such as user passwords.</li>
                <li>Circumvent, disable, or otherwise interfere with security-related features of the Services, including features that prevent or restrict the use or copying of any Content or enforce limitations on the use of the Services and/or the Content contained therein.</li>
                <li>Disparage, tarnish, or otherwise harm, in our opinion, us and/or the Services.</li>
                <li>Use any information obtained from the Services in order to harass, abuse, or harm another person.</li>
                <li>Make improper use of our support services or submit false reports of abuse or misconduct.</li>
                <li>Use the Services in a manner inconsistent with any applicable laws or regulations.</li>
                <li>Engage in unauthorised framing of or linking to the Services.</li>
                <li>Upload or transmit (or attempt to upload or to transmit) viruses, Trojan horses, or other material, including excessive use of capital letters and spamming (continuous posting of repetitive text), that interferes with any party&apos;s uninterrupted use and enjoyment of the Services or modifies, impairs, disrupts, alters, or interferes with the use, features, functions, operation, or maintenance of the Services.</li>
                <li>Engage in any automated use of the system, such as using scripts to send comments or messages, or using any data mining, robots, or similar data gathering and extraction tools.</li>
                <li>Delete the copyright or other proprietary rights notice from any Content.</li>
                <li>Attempt to impersonate another user or person or use the username of another user.</li>
                <li>Upload or transmit (or attempt to upload or to transmit) any material that acts as a passive or active information collection or transmission mechanism, including without limitation, clear graphics interchange formats (&apos;gifs&apos;), 1×1 pixels, web bugs, cookies, or other similar devices (sometimes referred to as &apos;spyware&apos; or &apos;passive collection mechanisms&apos; or &apos;pcms&apos;).</li>
                <li>Interfere with, disrupt, or create an undue burden on the Services or the networks or services connected to the Services.</li>
                <li>Harass, annoy, intimidate, or threaten any of our employees or agents engaged in providing any portion of the Services to you.</li>
                <li>Attempt to bypass any measures of the Services designed to prevent or restrict access to the Services, or any portion of the Services.</li>
                <li>Copy or adapt the Services&apos; software, including but not limited to Flash, PHP, HTML, JavaScript, or other code.</li>
                <li>Except as permitted by applicable law, decipher, decompile, disassemble, or reverse engineer any of the software comprising or in any way making up a part of the Services.</li>
                <li>Except as may be the result of standard search engine or Internet browser usage, use, launch, develop, or distribute any automated system, including without limitation, any spider, robot, cheat utility, scraper, or offline reader that accesses the Services, or use or launch any unauthorised script or other software.</li>
                <li>Use a buying agent or purchasing agent to make purchases on the Services.</li>
                <li>Make any unauthorised use of the Services, including collecting usernames and/or email addresses of users by electronic or other means for the purpose of sending unsolicited email, or creating user accounts by automated means or under false pretences.</li>
                <li>Use the Services as part of any effort to compete with us or otherwise use the Services and/or the Content for any revenue-generating endeavour or commercial enterprise.</li>
                <li>Sell or otherwise transfer your profile.</li>
              </ul>
            </div>
          </Tile>
        </section>

        {/* Section 8 */}
        <section id="contributions" className="scroll-mt-24">
          <Tile className="p-6 sm:p-8">
            <h2 className="text-lg font-bold text-ink sm:text-xl">8. USER GENERATED CONTRIBUTIONS</h2>
            <div className="mt-4 space-y-3">
              <p>
                The Services may invite you to chat, contribute to, or participate in blogs, message boards, online forums, and other functionality, and may provide you with the opportunity to create, submit, post, display, transmit, perform, publish, distribute, or broadcast content and materials to us or on the Services, including but not limited to text, writings, video, audio, photographs, graphics, comments, suggestions, or personal information or other material (collectively, &apos;Contributions&apos;). Contributions may be viewable by other users of the Services and through third-party websites. As such, any Contributions you transmit may be treated as non-confidential and non-proprietary. When you create or make available any Contributions, you thereby represent and warrant that:
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-ink-soft">
                <li>The creation, distribution, transmission, public display, or performance, and the accessing, downloading, or copying of your Contributions do not and will not infringe the proprietary rights, including but not limited to the copyright, patent, trademark, trade secret, or moral rights of any third party.</li>
                <li>You are the creator and owner of or have the necessary licences, rights, consents, releases, and permissions to use and to authorise us, the Services, and other users of the Services to use your Contributions in any manner contemplated by the Services and these Legal Terms.</li>
                <li>You have the written consent, release, and/or permission of each and every identifiable individual person in your Contributions to use the name or likeness of each and every such identifiable individual person to enable inclusion and use of your Contributions in any manner contemplated by the Services and these Legal Terms.</li>
                <li>Your Contributions are not false, inaccurate, or misleading.</li>
                <li>Your Contributions are not unsolicited or unauthorised advertising, promotional materials, pyramid schemes, chain letters, spam, mass mailings, or other forms of solicitation.</li>
                <li>Your Contributions are not obscene, lewd, lascivious, filthy, violent, harassing, libellous, slanderous, or otherwise objectionable (as determined by us).</li>
                <li>Your Contributions do not ridicule, mock, disparage, intimidate, or abuse anyone.</li>
                <li>Your Contributions are not used to harass or threaten (in the legal sense of those terms) any other person and to promote violence against a specific person or class of people.</li>
                <li>Your Contributions do not violate any applicable law, regulation, or rule.</li>
                <li>Your Contributions do not violate the privacy or publicity rights of any third party.</li>
                <li>Your Contributions do not violate any applicable law concerning child pornography, or otherwise intended to protect the health or well-being of minors.</li>
                <li>Your Contributions do not include any offensive comments that are connected to race, national origin, gender, sexual preference, or physical handicap.</li>
                <li>Your Contributions do not otherwise violate, or link to material that violates, any provision of these Legal Terms, or any applicable law or regulation.</li>
              </ul>
              <p>
                Any use of the Services in violation of the foregoing violates these Legal Terms and may result in, among other things, termination or suspension of your rights to use the Services.
              </p>
            </div>
          </Tile>
        </section>

        {/* Section 9 */}
        <section id="licence" className="scroll-mt-24">
          <Tile className="p-6 sm:p-8">
            <h2 className="text-lg font-bold text-ink sm:text-xl">9. CONTRIBUTION LICENCE</h2>
            <div className="mt-4 space-y-3">
              <p>
                By posting your Contributions to any part of the Services, you automatically grant, and you represent and warrant that you have the right to grant, to us an unrestricted, unlimited, irrevocable, perpetual, non-exclusive, transferable, royalty-free, fully-paid, worldwide right, and licence to host, use, copy, reproduce, disclose, sell, resell, publish, broadcast, retitle, archive, store, cache, publicly perform, publicly display, reformat, translate, transmit, excerpt (in whole or in part), and distribute such Contributions (including, without limitation, your image and voice) for any purpose, commercial, advertising, or otherwise, and to prepare derivative works of, or incorporate into other works, such Contributions, and grant and authorise sublicences of the foregoing. The use and distribution may occur in any media formats and through any media channels.
              </p>
              <p>
                This licence will apply to any form, media, or technology now known or hereafter developed, and includes our use of your name, company name, and franchise name, as applicable, and any of the trademarks, service marks, trade names, logos, and personal and commercial images you provide. You waive all moral rights in your Contributions, and you warrant that moral rights have not otherwise been asserted in your Contributions.
              </p>
              <p>
                We do not assert any ownership over your Contributions. You retain full ownership of all of your Contributions and any intellectual property rights or other proprietary rights associated with your Contributions. We are not liable for any statements or representations in your Contributions provided by you in any area on the Services. You are solely responsible for your Contributions to the Services and you expressly agree to exonerate us from any and all responsibility and to refrain from any legal action against us regarding your Contributions.
              </p>
              <p>
                We have the right, in our sole and absolute discretion, (1) to edit, redact, or otherwise change any Contributions; (2) to re-categorise any Contributions to place them in more appropriate locations on the Services; and (3) to pre-screen or delete any Contributions at any time and for any reason, without notice. We have no obligation to monitor your Contributions.
              </p>
            </div>
          </Tile>
        </section>

        {/* Section 10 */}
        <section id="reviews" className="scroll-mt-24">
          <Tile className="p-6 sm:p-8">
            <h2 className="text-lg font-bold text-ink sm:text-xl">10. GUIDELINES FOR REVIEWS</h2>
            <div className="mt-4 space-y-3">
              <p>
                We may provide you areas on the Services to leave reviews or ratings. When posting a review, you must comply with the following criteria: (1) you should have firsthand experience with the person/entity being reviewed; (2) your reviews should not contain offensive profanity, or abusive, racist, offensive, or hateful language; (3) your reviews should not contain discriminatory references based on religion, race, gender, national origin, age, marital status, sexual orientation, or disability; (4) your reviews should not contain references to illegal activity; (5) you should not be affiliated with competitors if posting negative reviews; (6) you should not make any conclusions as to the legality of conduct; (7) you may not post any false or misleading statements; and (8) you may not organise a campaign encouraging others to post reviews, whether positive or negative.
              </p>
              <p>
                We may accept, reject, or remove reviews in our sole discretion. We have absolutely no obligation to screen reviews or to delete reviews, even if anyone considers reviews objectionable or inaccurate. Reviews are not endorsed by us, and do not necessarily represent our opinions or the views of any of our affiliates or partners. We do not assume liability for any review or for any claims, liabilities, or losses resulting from any review. By posting a review, you hereby grant to us a perpetual, non-exclusive, worldwide, royalty-free, fully paid, assignable, and sublicensable right and licence to reproduce, modify, translate, transmit by any means, display, perform, and/or distribute all content relating to review.
              </p>
            </div>
          </Tile>
        </section>

        {/* Section 11 */}
        <section id="mobile-licence" className="scroll-mt-24">
          <Tile className="p-6 sm:p-8">
            <h2 className="text-lg font-bold text-ink sm:text-xl">11. MOBILE APPLICATION LICENCE</h2>
            <div className="mt-4 space-y-3">
              <h3 className="font-bold text-ink">Use Licence</h3>
              <p>
                If you access the Services via the App, then we grant you a revocable, non-exclusive, non-transferable, limited right to install and use the App on wireless electronic devices owned or controlled by you, and to access and use the App on such devices strictly in accordance with the terms and conditions of this mobile application licence contained in these Legal Terms. You shall not: (1) except as permitted by applicable law, decompile, reverse engineer, disassemble, attempt to derive the source code of, or decrypt the App; (2) make any modification, adaptation, improvement, enhancement, translation, or derivative work from the App; (3) violate any applicable laws, rules, or regulations in connection with your access or use of the App; (4) remove, alter, or obscure any proprietary notice (including any notice of copyright or trademark) posted by us or the licensors of the App; (5) use the App for any revenue-generating endeavour, commercial enterprise, or other purpose for which it is not designed or intended; (6) make the App available over a network or other environment permitting access or use by multiple devices or users at the same time; (7) use the App for creating a product, service, or software that is, directly or indirectly, competitive with or in any way a substitute for the App; (8) use the App to send automated queries to any website or to send any unsolicited commercial email; or (9) use any proprietary information or any of our interfaces or our other intellectual property in the design, development, manufacture, licensing, or distribution of any applications, accessories, or devices for use with the App.
              </p>
              <h3 className="pt-2 font-bold text-ink">Apple and Android Devices</h3>
              <p>
                The following terms apply when you use the App obtained from either the Apple Store or Google Play (each an &apos;App Distributor&apos;) to access the Services:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-ink-soft">
                <li>(1) the licence granted to you for our App is limited to a non-transferable licence to use the application on a device that utilises the Apple iOS or Android operating systems, as applicable, and in accordance with the usage rules set forth in the applicable App Distributor&apos;s terms of service;</li>
                <li>(2) we are responsible for providing any maintenance and support services with respect to the App as specified in the terms and conditions of this mobile application licence contained in these Legal Terms or as otherwise required under applicable law, and you acknowledge that each App Distributor has no obligation whatsoever to furnish any maintenance and support services with respect to the App;</li>
                <li>(3) in the event of any failure of the App to conform to any applicable warranty, you may notify the applicable App Distributor, and the App Distributor, in accordance with its terms and policies, may refund the purchase price, if any, paid for the App, and to the maximum extent permitted by applicable law, the App Distributor will have no other warranty obligation whatsoever with respect to the App;</li>
                <li>(4) you represent and warrant that (i) you are not located in a country that is subject to a US government embargo, or that has been designated by the US government as a &apos;terrorist supporting&apos; country and (ii) you are not listed on any US government list of prohibited or restricted parties;</li>
                <li>(5) you must comply with applicable third-party terms of agreement when using the App, e.g. if you have a VoIP application, then you must not be in violation of their wireless data service agreement when using the App; and</li>
                <li>(6) you acknowledge and agree that the App Distributors are third-party beneficiaries of the terms and conditions in this mobile application licence contained in these Legal Terms, and that each App Distributor will have the right (and will be deemed to have accepted the right) to enforce the terms and conditions in this mobile application licence contained in these Legal Terms against you as a third-party beneficiary thereof.</li>
              </ul>
            </div>
          </Tile>
        </section>

        {/* Section 12 */}
        <section id="management" className="scroll-mt-24">
          <Tile className="p-6 sm:p-8">
            <h2 className="text-lg font-bold text-ink sm:text-xl">12. SERVICES MANAGEMENT</h2>
            <div className="mt-4 space-y-3">
              <p>
                We reserve the right, but not the obligation, to: (1) monitor the Services for violations of these Legal Terms; (2) take appropriate legal action against anyone who, in our sole discretion, violates the law or these Legal Terms, including without limitation, reporting such user to law enforcement authorities; (3) in our sole discretion and without limitation, refuse, restrict access to, limit the availability of, or disable (to the extent technologically feasible) any of your Contributions or any portion thereof; (4) in our sole discretion and without limitation, notice, or liability, to remove from the Services or otherwise disable all files and content that are excessive in size or are in any way burdensome to our systems; and (5) otherwise manage the Services in a manner designed to protect our rights and property and to facilitate the proper functioning of the Services.
              </p>
            </div>
          </Tile>
        </section>

        {/* Section 13 */}
        <section id="termination" className="scroll-mt-24">
          <Tile className="p-6 sm:p-8">
            <h2 className="text-lg font-bold text-ink sm:text-xl">13. TERM AND TERMINATION</h2>
            <div className="mt-4 space-y-3">
              <p>
                These Legal Terms shall remain in full force and effect while you use the Services. <strong>WITHOUT LIMITING ANY OTHER PROVISION OF THESE LEGAL TERMS, WE RESERVE THE RIGHT TO, IN OUR SOLE DISCRETION AND WITHOUT NOTICE OR LIABILITY, DENY ACCESS TO AND USE OF THE SERVICES (INCLUDING BLOCKING CERTAIN IP ADDRESSES), TO ANY PERSON FOR ANY REASON OR FOR NO REASON, INCLUDING WITHOUT LIMITATION FOR BREACH OF ANY REPRESENTATION, WARRANTY, OR COVENANT CONTAINED IN THESE LEGAL TERMS OR OF ANY APPLICABLE LAW OR REGULATION. WE MAY TERMINATE YOUR USE OR PARTICIPATION IN THE SERVICES OR DELETE YOUR ACCOUNT AND ANY CONTENT OR INFORMATION THAT YOU POSTED AT ANY TIME, WITHOUT WARNING, IN OUR SOLE DISCRETION.</strong>
              </p>
              <p>
                If we terminate or suspend your account for any reason, you are prohibited from registering and creating a new account under your name, a fake or borrowed name, or the name of any third party, even if you may be acting on behalf of the third party. In addition to terminating or suspending your account, we reserve the right to take appropriate legal action, including without limitation pursuing civil, criminal, and injunctive redress.
              </p>
            </div>
          </Tile>
        </section>

        {/* Section 14 */}
        <section id="modifications" className="scroll-mt-24">
          <Tile className="p-6 sm:p-8">
            <h2 className="text-lg font-bold text-ink sm:text-xl">14. MODIFICATIONS AND INTERRUPTIONS</h2>
            <div className="mt-4 space-y-3">
              <p>
                We reserve the right to change, modify, or remove the contents of the Services at any time or for any reason at our sole discretion without notice. However, we have no obligation to update any information on our Services. We will not be liable to you or any third party for any modification, price change, suspension, or discontinuance of the Services.
              </p>
              <p>
                We cannot guarantee the Services will be available at all times. We may experience hardware, software, or other problems or need to perform maintenance related to the Services, resulting in interruptions, delays, or errors. We reserve the right to change, revise, update, suspend, discontinue, or otherwise modify the Services at any time or for any reason without notice to you. You agree that we have no liability whatsoever for any loss, damage, or inconvenience caused by your inability to access or use the Services during any downtime or discontinuance of the Services. Nothing in these Legal Terms will be construed to obligate us to maintain and support the Services or to supply any corrections, updates, or releases in connection therewith.
              </p>
            </div>
          </Tile>
        </section>

        {/* Section 15 */}
        <section id="governing-law" className="scroll-mt-24">
          <Tile className="p-6 sm:p-8">
            <h2 className="text-lg font-bold text-ink sm:text-xl">15. GOVERNING LAW</h2>
            <div className="mt-4 space-y-3">
              <p>
                These Legal Terms shall be governed by and defined following the laws of <strong>Ghana</strong>. <strong>Dekiru Company Limited</strong> and yourself irrevocably consent that the courts of Ghana shall have exclusive jurisdiction to resolve any dispute which may arise in connection with these Legal Terms.
              </p>
            </div>
          </Tile>
        </section>

        {/* Section 16 */}
        <section id="disputes" className="scroll-mt-24">
          <Tile className="p-6 sm:p-8">
            <h2 className="text-lg font-bold text-ink sm:text-xl">16. DISPUTE RESOLUTION</h2>
            <div className="mt-4 space-y-4">
              <h3 className="font-bold text-ink">Informal Negotiations</h3>
              <p>
                To expedite resolution and control the cost of any dispute, controversy, or claim related to these Legal Terms (each a &apos;Dispute&apos; and collectively, the &apos;Disputes&apos;) brought by either you or us (individually, a &apos;Party&apos; and collectively, the &apos;Parties&apos;), the Parties agree to first attempt to negotiate any Dispute (except those Disputes expressly provided below) informally for at least thirty (30) days before initiating arbitration. Such informal negotiations commence upon written notice from one Party to the other Party.
              </p>

              <h3 className="pt-2 font-bold text-ink">Binding Arbitration</h3>
              <p>
                If the parties are unable to resolve the dispute through informal negotiation, the dispute shall be finally resolved by arbitration in accordance with the United Nations Commission on International Trade Law Arbitration Rules in force at the time of commencement of the arbitration. The number of arbitrators shall be three (3). The seat, or legal place, of arbitration shall be Accra, Ghana. The language of the proceedings shall be English. The governing law of these Legal Terms shall be the substantive law of Ghana.
              </p>

              <h3 className="pt-2 font-bold text-ink">Restrictions</h3>
              <p>
                The Parties agree that any arbitration shall be limited to the Dispute between the Parties individually. To the full extent permitted by law, (a) no arbitration shall be joined with any other proceeding; (b) there is no right or authority for any Dispute to be arbitrated on a class-action basis or to utilise class action procedures; and (c) there is no right or authority for any Dispute to be brought in a purported representative capacity on behalf of the general public or any other persons.
              </p>

              <h3 className="pt-2 font-bold text-ink">Exceptions to Informal Negotiations and Arbitration</h3>
              <p>
                The Parties agree that the following Disputes are not subject to the above provisions concerning informal negotiations binding arbitration: (a) any Disputes seeking to enforce or protect, or concerning the validity of, any of the intellectual property rights of a Party; (b) any Dispute related to, or arising from, allegations of theft, piracy, invasion of privacy, or unauthorised use; and (c) any claim for injunctive relief. If this provision is found to be illegal or unenforceable, then neither Party will elect to arbitrate any Dispute falling within that portion of this provision found to be illegal or unenforceable and such Dispute shall be decided by a court of competent jurisdiction within the courts listed for jurisdiction above, and the Parties agree to submit to the personal jurisdiction of that court.
              </p>
            </div>
          </Tile>
        </section>

        {/* Section 17 */}
        <section id="corrections" className="scroll-mt-24">
          <Tile className="p-6 sm:p-8">
            <h2 className="text-lg font-bold text-ink sm:text-xl">17. CORRECTIONS</h2>
            <div className="mt-4 space-y-3">
              <p>
                There may be information on the Services that contains typographical errors, inaccuracies, or omissions, including descriptions, pricing, availability, and various other information. We reserve the right to correct any errors, inaccuracies, or omissions and to change or update the information on the Services at any time, without prior notice.
              </p>
            </div>
          </Tile>
        </section>

        {/* Section 18 */}
        <section id="disclaimer" className="scroll-mt-24">
          <Tile className="p-6 sm:p-8">
            <h2 className="text-lg font-bold text-ink sm:text-xl">18. DISCLAIMER</h2>
            <div className="mt-4 space-y-3 text-xs leading-relaxed text-ink-soft uppercase sm:text-sm">
              <p>
                THE SERVICES ARE PROVIDED ON AN AS-IS AND AS-AVAILABLE BASIS. YOU AGREE THAT YOUR USE OF THE SERVICES WILL BE AT YOUR SOLE RISK. TO THE FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, IN CONNECTION WITH THE SERVICES AND YOUR USE THEREOF, INCLUDING, WITHOUT LIMITATION, THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
              </p>
              <p>
                WE MAKE NO WARRANTIES OR REPRESENTATIONS ABOUT THE ACCURACY OR COMPLETENESS OF THE SERVICES&apos; CONTENT OR THE CONTENT OF ANY WEBSITES OR MOBILE APPLICATIONS LINKED TO THE SERVICES AND WE WILL ASSUME NO LIABILITY OR RESPONSIBILITY FOR ANY (1) ERRORS, MISTAKES, OR INACCURACIES OF CONTENT AND MATERIALS, (2) PERSONAL INJURY OR PROPERTY DAMAGE, OF ANY NATURE WHATSOEVER, RESULTING FROM YOUR ACCESS TO AND USE OF THE SERVICES, (3) ANY UNAUTHORISED ACCESS TO OR USE OF OUR SECURE SERVERS AND/OR ANY AND ALL PERSONAL INFORMATION AND/OR FINANCIAL INFORMATION STORED THEREIN, (4) ANY INTERRUPTION OR CESSATION OF TRANSMISSION TO OR FROM THE SERVICES, (5) ANY BUGS, VIRUSES, TROJAN HORSES, OR THE LIKE WHICH MAY BE TRANSMITTED TO OR THROUGH THE SERVICES BY ANY THIRD PARTY, AND/OR (6) ANY ERRORS OR OMISSIONS IN ANY CONTENT AND MATERIALS OR FOR ANY LOSS OR DAMAGE OF ANY KIND INCURRED AS A RESULT OF THE USE OF ANY CONTENT POSTED, TRANSMITTED, OR OTHERWISE MADE AVAILABLE VIA THE SERVICES.
              </p>
              <p>
                WE DO NOT WARRANT, ENDORSE, GUARANTEE, OR ASSUME RESPONSIBILITY FOR ANY PRODUCT OR SERVICE ADVERTISED OR OFFERED BY A THIRD PARTY THROUGH THE SERVICES, ANY HYPERLINKED WEBSITE, OR ANY WEBSITE OR MOBILE APPLICATION FEATURED IN ANY BANNER OR OTHER ADVERTISING, AND WE WILL NOT BE A PARTY TO OR IN ANY WAY BE RESPONSIBLE FOR MONITORING ANY TRANSACTION BETWEEN YOU AND ANY THIRD-PARTY PROVIDERS OF PRODUCTS OR SERVICES. AS WITH THE PURCHASE OF A PRODUCT OR SERVICE THROUGH ANY MEDIUM OR IN ANY ENVIRONMENT, YOU SHOULD USE YOUR BEST JUDGEMENT AND EXERCISE CAUTION WHERE APPROPRIATE.
              </p>
            </div>
          </Tile>
        </section>

        {/* Section 19 */}
        <section id="liability" className="scroll-mt-24">
          <Tile className="p-6 sm:p-8">
            <h2 className="text-lg font-bold text-ink sm:text-xl">19. LIMITATIONS OF LIABILITY</h2>
            <div className="mt-4 space-y-3 text-xs leading-relaxed text-ink-soft uppercase sm:text-sm">
              <p>
                IN NO EVENT WILL WE OR OUR DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE TO YOU OR ANY THIRD PARTY FOR ANY DIRECT, INDIRECT, CONSEQUENTIAL, EXEMPLARY, INCIDENTAL, SPECIAL, OR PUNITIVE DAMAGES, INCLUDING LOST PROFIT, LOST REVENUE, LOSS OF DATA, OR OTHER DAMAGES ARISING FROM YOUR USE OF THE SERVICES, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
              </p>
              <p>
                NOTWITHSTANDING ANYTHING TO THE CONTRARY CONTAINED HEREIN, OUR LIABILITY TO YOU FOR ANY CAUSE WHATSOEVER AND REGARDLESS OF THE FORM OF THE ACTION, WILL AT ALL TIMES BE LIMITED TO THE AMOUNT PAID, IF ANY, BY YOU TO US DURING THE SIX (6) MONTH PERIOD PRIOR TO ANY CAUSE OF ACTION ARISING. CERTAIN US STATE LAWS AND INTERNATIONAL LAWS DO NOT ALLOW LIMITATIONS ON IMPLIED WARRANTIES OR THE EXCLUSION OR LIMITATION OF CERTAIN DAMAGES. IF THESE LAWS APPLY TO YOU, SOME OR ALL OF THE ABOVE DISCLAIMERS OR LIMITATIONS MAY NOT APPLY TO YOU, AND YOU MAY HAVE ADDITIONAL RIGHTS.
              </p>
            </div>
          </Tile>
        </section>

        {/* Section 20 */}
        <section id="indemnification" className="scroll-mt-24">
          <Tile className="p-6 sm:p-8">
            <h2 className="text-lg font-bold text-ink sm:text-xl">20. INDEMNIFICATION</h2>
            <div className="mt-4 space-y-3">
              <p>
                You agree to defend, indemnify, and hold us harmless, including our subsidiaries, affiliates, and all of our respective officers, agents, partners, and employees, from and against any loss, damage, liability, claim, or demand, including reasonable attorneys&apos; fees and expenses, made by any third party due to or arising out of: (1) your Contributions; (2) use of the Services; (3) breach of these Legal Terms; (4) any breach of your representations and warranties set forth in these Legal Terms; (5) your violation of the rights of a third party, including but not limited to intellectual property rights; or (6) any overt harmful act toward any other user of the Services with whom you connected via the Services.
              </p>
              <p>
                Notwithstanding the foregoing, we reserve the right, at your expense, to assume the exclusive defence and control of any matter for which you are required to indemnify us, and you agree to cooperate, at your expense, with our defence of such claims. We will use reasonable efforts to notify you of any such claim, action, or proceeding which is subject to this indemnification upon becoming aware of it.
              </p>
            </div>
          </Tile>
        </section>

        {/* Section 21 */}
        <section id="user-data" className="scroll-mt-24">
          <Tile className="p-6 sm:p-8">
            <h2 className="text-lg font-bold text-ink sm:text-xl">21. USER DATA</h2>
            <div className="mt-4 space-y-3">
              <p>
                We will maintain certain data that you transmit to the Services for the purpose of managing the performance of the Services, as well as data relating to your use of the Services. Although we perform regular routine backups of data, you are solely responsible for all data that you transmit or that relates to any activity you have undertaken using the Services. You agree that we shall have no liability to you for any loss or corruption of any such data, and you hereby waive any right of action against us arising from any such loss or corruption of such data.
              </p>
            </div>
          </Tile>
        </section>

        {/* Section 22 */}
        <section id="electronic" className="scroll-mt-24">
          <Tile className="p-6 sm:p-8">
            <h2 className="text-lg font-bold text-ink sm:text-xl">22. ELECTRONIC COMMUNICATIONS, TRANSACTIONS, AND SIGNATURES</h2>
            <div className="mt-4 space-y-3">
              <p>
                Visiting the Services, sending us emails, and completing online forms constitute electronic communications. You consent to receive electronic communications, and you agree that all agreements, notices, disclosures, and other communications we provide to you electronically, via email and on the Services, satisfy any legal requirement that such communication be in writing.
              </p>
              <p className="font-bold text-ink">
                YOU HEREBY AGREE TO THE USE OF ELECTRONIC SIGNATURES, CONTRACTS, ORDERS, AND OTHER RECORDS, AND TO ELECTRONIC DELIVERY OF NOTICES, POLICIES, AND RECORDS OF TRANSACTIONS INITIATED OR COMPLETED BY US OR VIA THE SERVICES.
              </p>
              <p>
                You hereby waive any rights or requirements under any statutes, regulations, rules, ordinances, or other laws in any jurisdiction which require an original signature or delivery or retention of non-electronic records, or to payments or the granting of credits by any means other than electronic means.
              </p>
            </div>
          </Tile>
        </section>

        {/* Section 23 */}
        <section id="miscellaneous" className="scroll-mt-24">
          <Tile className="p-6 sm:p-8">
            <h2 className="text-lg font-bold text-ink sm:text-xl">23. MISCELLANEOUS</h2>
            <div className="mt-4 space-y-3">
              <p>
                These Legal Terms and any policies or operating rules posted by us on the Services or in respect to the Services constitute the entire agreement and understanding between you and us. Our failure to exercise or enforce any right or provision of these Legal Terms shall not operate as a waiver of such right or provision. These Legal Terms operate to the fullest extent permissible by law.
              </p>
              <p>
                We may assign any or all of our rights and obligations to others at any time. We shall not be responsible or liable for any loss, damage, delay, or failure to act caused by any cause beyond our reasonable control. If any provision or part of a provision of these Legal Terms is determined to be unlawful, void, or unenforceable, that provision or part of the provision is deemed severable from these Legal Terms and does not affect the validity and enforceability of any remaining provisions.
              </p>
              <p>
                There is no joint venture, partnership, employment or agency relationship created between you and us as a result of these Legal Terms or use of the Services. You agree that these Legal Terms will not be construed against us by virtue of having drafted them. You hereby waive any and all defences you may have based on the electronic form of these Legal Terms and the lack of signing by the parties hereto to execute these Legal Terms.
              </p>
            </div>
          </Tile>
        </section>

        {/* Section 24 */}
        <section id="contact" className="scroll-mt-24">
          <Tile className="p-6 sm:p-8">
            <h2 className="text-lg font-bold text-ink sm:text-xl">24. CONTACT US</h2>
            <p className="mt-3 text-ink-soft">
              In order to resolve a complaint regarding the Services or to receive further information regarding use of the Services, please contact us at:
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-grout/60 p-4">
                <MapPin className="size-5 shrink-0 text-cobalt-bright mt-0.5" aria-hidden />
                <div className="text-xs sm:text-sm text-ink-soft">
                  <p className="font-bold text-ink">Dekiru Company Limited</p>
                  <p>Kirulabs, 21 opeabere avenue</p>
                  <p>Accra, Greater Accra 233</p>
                  <p>Ghana</p>
                </div>
              </div>

              <div className="flex flex-col justify-center gap-3 rounded-2xl border border-slate-100 bg-grout/60 p-4 text-xs sm:text-sm text-ink-soft">
                <div className="flex items-center gap-2">
                  <Phone className="size-4 shrink-0 text-cobalt-bright" aria-hidden />
                  <a href="tel:+233547601618" className="font-bold text-ink hover:text-cobalt">
                    (+233) 54 760 1618
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="size-4 shrink-0 text-cobalt-bright" aria-hidden />
                  <a href="mailto:kirulabsofficial@gmail.com" className="font-bold text-ink hover:text-cobalt">
                    kirulabsofficial@gmail.com
                  </a>
                </div>
              </div>
            </div>

            <p className="mt-6 text-xs text-ink-faint">
              This Terms and Conditions was created using Termly&apos;s Terms and Conditions Generator.
            </p>
          </Tile>
        </section>
      </article>

      {/* Floating Back to Top Button */}
      <div className="mt-12 flex items-center justify-between border-t border-grout pt-6">
        <Link to="/privacy" className="text-xs font-bold text-cobalt hover:underline sm:text-sm">
          ← Review Privacy Policy
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
