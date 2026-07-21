/**
 * Idempotent seed for the Legal CMS. Safe to re-run in any environment —
 * it only creates version 1 for a document type if that document has
 * never been published before. It never touches documents an admin has
 * already started editing/publishing through the CMS.
 */
import { PrismaClient, LegalDocumentType, LegalVersionStatus } from '@prisma/client';

const prisma = new PrismaClient();
const LOCALE = 'en';
const EFFECTIVE_DATE = new Date('2026-07-17T00:00:00.000Z');

const APP_NAME = 'PalSafar';
const SUPPORT_EMAIL = 'support@palsafar.com';
const PRIVACY_EMAIL = 'privacy@palsafar.com';
const LEGAL_EMAIL = 'legal@palsafar.com';

const DOCUMENTS: Record<LegalDocumentType, { title: string; content: string }> = {
  PRIVACY_POLICY: {
    title: 'Privacy Policy',
    content: `# Privacy Policy

**Effective Date:** July 17, 2026

${APP_NAME} ("we", "us", "our") respects your privacy. This Privacy Policy explains what information we collect, how we use it, and the choices you have. By using ${APP_NAME}, you agree to this Policy.

## 1. Information We Collect

### 1.1 Information you provide
- Account details: name, email, phone number, password (stored hashed, never in plain text)
- Profile information: avatar, bio, travel preferences
- Content you create: reviews, photos, videos, reels, trip plans, hidden gem submissions
- Vendor/Creator application details, business documents, and verification information

### 1.2 Information collected automatically
- **Location data (GPS):** used for map features, nearby recommendations, check-ins, and hidden gem discovery. You can disable location access at any time in your device settings; some features will be limited without it.
- **Camera and photo library:** accessed only when you choose to upload a photo, video, or reel. We never access your camera/gallery in the background.
- **Device and usage analytics:** device model, OS version, app version, crash reports, and in-app interactions, used to improve stability and performance.
- **Cookies and similar technologies** (web/admin dashboard only): session tokens and preference cookies.

### 1.3 Wallet and Rewards data
- PalPoints balance, transaction history, redemption history, and offer/reward claims, used solely to operate the loyalty program described in our Rewards Policy.

## 2. How We Use Your Information
- To provide, maintain, and improve the ${APP_NAME} app and its features
- To personalize recommendations (places, hidden gems, itineraries)
- To operate the PalPoints wallet and rewards program
- To communicate with you (service updates, security alerts, and — only with your consent — marketing messages)
- To detect, investigate, and prevent fraud, abuse, and policy violations
- To comply with legal obligations

## 3. Third-Party Services
We use trusted third-party providers to operate ${APP_NAME}:
- **Google Maps Platform** — maps, geocoding, and directions
- **Cloudinary** — secure storage and delivery of photos and videos you upload
- **Payment/Reward providers** — where applicable, to fulfil reward redemptions
- **Push notification providers (Firebase Cloud Messaging)** — to deliver notifications you have opted into

These providers only receive the minimum data needed to perform their function and are contractually bound to protect it. We do not sell your personal data to advertisers or data brokers.

## 4. Data Retention
We retain your data for as long as your account is active. If you delete your account, we delete or anonymize your personal data within 30 days, except where we must retain records for legal, tax, fraud-prevention, or dispute-resolution purposes (for example, redemption and audit records may be retained longer as required by law).

## 5. Your Rights & Deletion Requests
You may at any time:
- Access, correct, or export your profile data from Settings
- Withdraw consent for marketing communications
- Request deletion of your account and associated personal data via **Settings → Delete Account**, or by emailing ${PRIVACY_EMAIL}

We will action deletion requests within 30 days, subject to the retention exceptions above.

## 6. Children's Privacy
${APP_NAME} is not directed at children under 13 (or the minimum age required in your country). We do not knowingly collect personal data from children. If we learn we have collected such data, we will delete it promptly.

## 7. Data Security
We use industry-standard measures including encryption in transit (TLS), hashed passwords, encrypted local storage of session tokens, and role-based access control to protect your data. No method of transmission or storage is 100% secure, and we cannot guarantee absolute security.

## 8. International Users
Your data may be processed on servers located outside your country of residence. We take steps to ensure an adequate level of protection wherever your data is processed.

## 9. Changes to This Policy
We may update this Privacy Policy from time to time. Material changes will be highlighted in-app with a new effective date. Continued use of ${APP_NAME} after changes take effect constitutes acceptance.

## 10. Contact Us
Questions about this Privacy Policy or your data? Contact us at **${PRIVACY_EMAIL}**.`,
  },

  TERMS_CONDITIONS: {
    title: 'Terms & Conditions',
    content: `# Terms & Conditions

**Effective Date:** July 17, 2026

Welcome to ${APP_NAME}. These Terms & Conditions ("Terms") govern your use of the ${APP_NAME} mobile application and related services (the "Service"). By creating an account or using the Service, you agree to these Terms.

## 1. Eligibility
You must be at least 13 years old to create an account. If you are under the age of majority in your jurisdiction, you confirm you have permission from a parent or guardian to use the Service.

## 2. Your Account
- You are responsible for maintaining the confidentiality of your login credentials.
- One person may hold only one ${APP_NAME} account. Each account starts as a standard **User** account and may add a **Vendor** and/or **Content Creator** specialty after approval.
- You must provide accurate information and promptly update it if it changes.
- We may suspend or terminate accounts that violate these Terms.

## 3. User Responsibilities
As a User, you agree to:
- Use the Service only for lawful purposes
- Post accurate reviews and honest content
- Respect other users, vendors, and creators
- Not misuse location features, hidden gem submissions, or the rewards system

## 4. Vendor Responsibilities
Approved Vendors agree to:
- Provide accurate business information, offers, and pricing
- Honor published offers and PalPoints redemptions in good faith
- Comply with all applicable local business, tax, and consumer-protection laws
- Not post misleading claims, discriminatory offers, or fraudulent redemption codes

## 5. Creator Responsibilities
Approved Content Creators agree to:
- Only upload original content or content they have rights to publish
- Accurately represent locations and experiences shown in Reels
- Comply with our Community Guidelines and disclose paid partnerships where applicable
- Not engage in engagement fraud (bought followers/views, fake likes, bot activity)

## 6. Hidden Gem Guidelines
Hidden Gem submissions must be genuine, accurately located, safe to visit, and not on private property without permission. We reserve the right to reject, edit, or remove submissions that violate these Terms or our Community Guidelines.

## 7. Reviews & User Content
You retain ownership of content you post but grant ${APP_NAME} a worldwide, royalty-free, non-exclusive license to host, display, and distribute it within the Service. Reviews must reflect genuine experiences. Fake, incentivized (in exchange for payment), or defamatory reviews are prohibited and may be removed.

## 8. Uploads & Prohibited Content
You may not upload content that is illegal, infringing, sexually explicit, hateful, violent, or that violates any third party's rights. We may remove any content and suspend accounts at our discretion for violations.

## 9. Copyright
If you believe content on ${APP_NAME} infringes your copyright, contact ${LEGAL_EMAIL} with details of the material and your ownership claim. We will investigate and take appropriate action, including removal.

## 10. Suspension & Termination
We may suspend or terminate your account, including Vendor or Creator status, for violations of these Terms, fraudulent activity, or at our reasonable discretion, with or without notice depending on severity. You may delete your account at any time via Settings.

## 11. Rewards & Offers
PalPoints, offers, and rewards are governed by our **Rewards Policy**. Rewards are **not guaranteed** — all campaigns, offers, and redemptions are subject to availability, eligibility, and the specific terms published with each reward.

## 12. Disclaimers
The Service is provided "as is" and "as available." We do not guarantee the accuracy of vendor listings, hidden gem locations, distances, prices, or availability of offers. Always verify important details (opening hours, safety, pricing) independently before relying on them, especially for travel decisions.

## 13. Limitation of Liability
To the maximum extent permitted by law, ${APP_NAME} is not liable for indirect, incidental, or consequential damages arising from your use of the Service, including but not limited to travel decisions, third-party vendor disputes, or user-generated content.

## 14. Refunds
Where applicable, refund eligibility for paid features or vendor subscriptions is governed by our Refund Policy.

## 15. Governing Law
These Terms are governed by the laws of India, without regard to conflict-of-law principles. Any disputes shall be subject to the exclusive jurisdiction of the courts located in India.

## 16. Changes to These Terms
We may update these Terms periodically. Continued use after changes take effect constitutes acceptance of the revised Terms.

## 17. Contact
Questions about these Terms? Contact **${LEGAL_EMAIL}**.`,
  },

  REWARDS_POLICY: {
    title: 'Rewards Policy',
    content: `# Rewards Policy

**Effective Date:** July 17, 2026

${APP_NAME}'s reward program is built around **PalPoints**, an in-app loyalty currency. This policy explains how PalPoints work and sets expectations about rewards and offers.

## 1. What Are PalPoints
PalPoints are a **non-transferable, non-cash, in-app loyalty currency**. They have **no monetary value**, cannot be exchanged for cash, transferred between accounts, or sold. PalPoints are awarded solely at ${APP_NAME}'s discretion for eligible in-app activity (e.g., daily login, exploring places, submitting hidden gems).

## 2. Important Disclaimers
- **Rewards are never guaranteed.** Reward campaigns, offers, and prize slots are limited and awarded on a first-come, first-served or eligibility basis as described in each campaign's specific terms.
- **No purchase necessary** to earn or redeem standard PalPoints unless explicitly stated in a specific campaign.
- Displayed reward items (e.g., merchandise, vendor discounts) are illustrative of what may be available and **are not a promise of specific inventory, brand, or model** unless expressly confirmed in the reward's terms and conditions at the time of redemption.
- Reward campaigns may be modified, paused, or discontinued by ${APP_NAME} or participating vendors at any time, including after you have accumulated points, though we will honor already-approved redemptions in progress wherever reasonably possible.

## 3. Earning PalPoints
Points may be earned through actions such as logging in, visiting places, completing trips, and other activities defined by our Point Rules, which may change over time. Earning rates and eligible activities are configurable and may vary by promotion.

## 4. Redeeming PalPoints
- Points can be redeemed for vendor offers via in-app QR codes, or entered into reward campaigns for a chance to win prizes, subject to each campaign's specific eligibility rules, winner slots, and terms & conditions.
- Redemption requests are reviewed and may be approved, rejected, or fulfilled by ${APP_NAME} or the relevant vendor.
- Attempting to redeem points fraudulently (e.g., through fake activity, multiple accounts, or bots) will result in forfeiture of points and possible account suspension.

## 5. Expiry & Forfeiture
Unless stated otherwise, PalPoints do not expire while your account remains active and in good standing. Points may be forfeited if your account is deleted, suspended, or terminated for violation of our Terms & Conditions.

## 6. Vendor-Fulfilled Rewards
Where a reward is fulfilled by a third-party Vendor (e.g., a discount at a local business), ${APP_NAME} facilitates the offer but is not responsible for the Vendor's service quality, stock availability, or business practices. Vendor-specific terms apply to each offer.

## 7. Tax & Legal Compliance
Where required by applicable law, recipients of physical or high-value rewards may be required to provide identification or tax information before fulfillment. ${APP_NAME} reserves the right to substitute a reward of comparable value where the original is unavailable.

## 8. Changes to This Policy
We may update this Rewards Policy, point-earning rules, or specific campaign terms at any time. Material changes will be reflected with a new effective date.

## 9. Contact
Questions about PalPoints or a specific reward campaign? Contact **${SUPPORT_EMAIL}**.`,
  },

  COMMUNITY_GUIDELINES: {
    title: 'Community Guidelines',
    content: `# Community Guidelines

**Effective Date:** July 17, 2026

${APP_NAME} is a community of travelers, local vendors, and creators. These guidelines keep our community safe, honest, and welcoming.

## 1. Be Respectful
Treat other members, vendors, and creators with respect. Harassment, hate speech, threats, and discriminatory content based on race, religion, gender, sexual orientation, disability, or nationality are strictly prohibited.

## 2. Be Honest
- Post reviews and ratings based on genuine experiences only.
- Do not post fake reviews, incentivized reviews without disclosure, or reviews for places you have not visited.
- Hidden Gem submissions must be real, accurately located, and safe to access.

## 3. Content Standards
Do not upload content that is:
- Sexually explicit, violent, or gratuitously disturbing
- Illegal, or promotes illegal activity
- Infringing on someone else's copyright or intellectual property
- Spam, scams, or deceptive links

## 4. Safety First
- Never recommend or promote unsafe, illegal, or trespassing access to a location.
- Respect private property and local regulations when submitting Hidden Gems.
- Report unsafe locations or misleading safety information immediately via **Report a Bug/Safety Report** in the Help Center.

## 5. Creator Conduct
Creators must disclose paid partnerships or sponsorships in Reels, avoid engagement fraud, and accurately represent the locations and experiences shown.

## 6. Vendor Conduct
Vendors must honor published offers, keep business information accurate, and not use the platform to mislead customers about pricing, availability, or authenticity.

## 7. Reporting Violations
Use the in-app "Report" option on any piece of content, or contact ${SUPPORT_EMAIL}, to flag violations of these Guidelines. All reports are reviewed by our moderation team.

## 8. Enforcement
Violations may result in content removal, warnings, feature restrictions, or account/Vendor/Creator status suspension, depending on severity and repetition, at ${APP_NAME}'s discretion.

## 9. Changes
These Guidelines may be updated periodically to reflect the evolving needs of our community.`,
  },

  VENDOR_TERMS: {
    title: 'Vendor Terms',
    content: `# Vendor Terms

**Effective Date:** July 17, 2026

These Vendor Terms apply in addition to our general Terms & Conditions to any account approved with **Vendor** status on ${APP_NAME}.

## 1. Application & Approval
Vendor status requires an application with accurate business details, which is reviewed and approved by ${APP_NAME}. We may request supporting documents to verify business legitimacy and may reject or revoke Vendor status at our discretion, including for incomplete, false, or misleading applications.

## 2. Business Listing Accuracy
You are responsible for keeping your business name, category, location, hours, contact details, and offers accurate and up to date. Misrepresenting your business, location, or offers is a violation of these Terms.

## 3. Offers & Redemptions
- Offers you publish must be honored as described for the duration stated, unless paused or ended in accordance with these Terms.
- You are responsible for validating and honoring PalPoints redemption QR codes presented by customers in good faith.
- ${APP_NAME} is not responsible for disputes between you and customers regarding offer fulfillment, but may mediate or suspend listings found to be fraudulent or repeatedly misleading.

## 4. Reviews
You may not manipulate reviews (e.g., paying for fake reviews, pressuring customers, or retaliating against negative reviewers). You may respond publicly and professionally to reviews.

## 5. Fees & Subscriptions
Where ${APP_NAME} introduces paid Vendor subscription tiers or promoted placements, applicable fees, billing cycles, and cancellation terms will be disclosed at the time of purchase and are governed by our Refund Policy.

## 6. Analytics Data
Vendor dashboard analytics (views, redemptions, customer engagement) are provided for your business insight only and may not be resold, redistributed, or used to build a competing service.

## 7. Compliance
You must comply with all applicable local, state, and national laws relevant to your business, including consumer protection, food safety, and tax regulations. ${APP_NAME} is a discovery and rewards platform and does not verify regulatory compliance of listed businesses beyond application review.

## 8. Termination
${APP_NAME} may suspend or revoke Vendor status for Terms violations, fraud, repeated customer complaints, or business closure. You may request voluntary deactivation of your Vendor status at any time via Vendor Settings.`,
  },

  CREATOR_TERMS: {
    title: 'Creator Terms',
    content: `# Creator Terms

**Effective Date:** July 17, 2026

These Creator Terms apply in addition to our general Terms & Conditions to any account approved with **Content Creator** status on ${APP_NAME}.

## 1. Application & Approval
Creator status requires an application reviewed by ${APP_NAME}, which may consider sample content, social presence, and adherence to our Community Guidelines. We may reject or revoke Creator status at our discretion.

## 2. Content Ownership & License
You retain ownership of your Reels and content. By posting, you grant ${APP_NAME} a worldwide, royalty-free, non-exclusive license to host, display, distribute, and promote your content within the Service (including in recommendations and marketing of the app itself).

## 3. Original Content Only
You must only upload content you created or have explicit rights to use. Do not upload content that infringes another person's copyright, likeness, or trademark rights.

## 4. Accurate Representation
Reels depicting places must accurately represent the location, experience, and any conditions (e.g., entry fees, accessibility, seasonal availability) reasonably known to you at the time of posting.

## 5. Disclosures
You must clearly disclose paid partnerships, sponsorships, or any material compensation received in connection with a Reel, in line with applicable advertising disclosure laws and our Community Guidelines.

## 6. Engagement Integrity
Buying followers, views, likes, or comments, or using bots/automation to inflate metrics, is prohibited and may result in suspension of Creator status and removal of affected content.

## 7. Analytics & Follower Data
Creator dashboard analytics are for your own insight only and may not be resold or redistributed.

## 8. Monetization (Future-Ready)
Where ${APP_NAME} introduces Creator monetization features (e.g., brand collaborations, tips, or revenue share), additional terms specific to that feature will be presented and must be accepted before participation.

## 9. Termination
${APP_NAME} may suspend or revoke Creator status for Terms or Community Guidelines violations, engagement fraud, or repeated content policy breaches. You may request voluntary deactivation of your Creator status at any time via Creator Settings.`,
  },

  REFUND_POLICY: {
    title: 'Refund Policy',
    content: `# Refund Policy

**Effective Date:** July 17, 2026

${APP_NAME} is currently free to use for Users, Vendors, and Creators. This Refund Policy is published in advance and will govern any future paid features, subscriptions, or promoted placements introduced to the Service.

## 1. Current Status
As of the effective date above, ${APP_NAME} does not charge Users, Vendors, or Creators for core app access. PalPoints and rewards are not purchased and therefore are not eligible for monetary refunds — see our Rewards Policy for details on how points work.

## 2. Future Paid Features
If ${APP_NAME} introduces paid features (such as Vendor subscription tiers, promoted listings, or premium Creator tools), the following principles will apply unless a specific offer states otherwise:
- **Eligibility window:** Refund requests must be made within 7 days of the charge date.
- **Unused services:** Full refunds are generally available for services not yet rendered (e.g., a promoted placement that has not yet started).
- **Partially used services:** Pro-rated refunds may be issued for subscription periods, at ${APP_NAME}'s discretion.
- **Non-refundable items:** One-time fees for services already fully rendered (e.g., a completed promotional campaign) are generally non-refundable.

## 3. How to Request a Refund
Once paid features are introduced, refund requests can be submitted via **Help Center → Contact Us**, including your account email, transaction ID, and reason for the request. We aim to respond within 5 business days.

## 4. Chargebacks & Disputes
Filing a chargeback with your payment provider without first contacting ${APP_NAME} support may result in suspension of paid features on your account pending resolution.

## 5. Changes to This Policy
This Refund Policy will be updated with specific terms at the time any paid feature is launched, and the effective date will be revised accordingly.

## 6. Contact
Billing questions can be directed to **${SUPPORT_EMAIL}**.`,
  },

  ABOUT_US: {
    title: 'About Us',
    content: `# About PalSafar

${APP_NAME} is a travel discovery platform built to help you explore India like a local — find hidden gems, plan smarter trips, support local vendors, and share your journeys through Reels.

## Our Mission
To make every trip more meaningful by connecting travelers with authentic places, genuine local businesses, and a community of creators who love to explore.

## What You Can Do on ${APP_NAME}
- **Discover** curated places and community-submitted Hidden Gems near you
- **Plan** AI-assisted itineraries tailored to your interests and pace
- **Earn** PalPoints for exploring and redeem them for local vendor offers
- **Share** your travel moments through Reels as a Content Creator
- **Grow** your local business by joining as a Vendor and reaching engaged travelers

## Our Values
- **Authenticity** — real places, real reviews, real recommendations
- **Community first** — travelers, vendors, and creators grow together
- **Responsible discovery** — respecting local communities, safety, and the environment
- **Transparency** — clear policies, honest rewards, no hidden surprises

## Get in Touch
We're always improving ${APP_NAME} based on your feedback. Reach out anytime — see our Contact Information page for details.`,
  },

  CONTACT_INFO: {
    title: 'Contact Information',
    content: `# Contact Information

We'd love to hear from you. Here's how to reach the ${APP_NAME} team.

## General Support
For questions, feedback, or help using the app:
**Email:** ${SUPPORT_EMAIL}

## Privacy & Data Requests
For privacy questions or data deletion requests:
**Email:** ${PRIVACY_EMAIL}

## Legal & Copyright
For legal notices, Terms questions, or copyright claims:
**Email:** ${LEGAL_EMAIL}

## Report a Safety Issue or Bug
Use **Help Center → Report a Bug** or **Safety Report** inside the app for the fastest response, or email ${SUPPORT_EMAIL} with as much detail as possible (screenshots, steps to reproduce, and device information help us resolve issues quickly).

## Business Inquiries (Vendors & Partnerships)
**Email:** ${SUPPORT_EMAIL}

## Response Times
We aim to respond to all inquiries within 2–5 business days. Safety-related reports are prioritized.`,
  },

  FAQ: {
    title: 'Frequently Asked Questions',
    content: `# Frequently Asked Questions

## Account & Profile

**How do I create an account?**
Sign up with your email and password from the welcome screen. Every account starts as a standard User.

**Can I have both a Vendor and Creator account?**
No — one person has only one ${APP_NAME} account. You can apply for **either** Vendor **or** Creator specialty status in addition to your User profile, and switch between them from your Profile screen once approved.

**How do I delete my account?**
Go to **Settings → Delete Account**. You'll need to confirm your password. This action is permanent and follows the deletion timelines described in our Privacy Policy.

## PalPoints & Rewards

**What are PalPoints?**
PalPoints are ${APP_NAME}'s in-app loyalty currency, earned through activities like logging in and exploring places. They have no cash value and cannot be transferred. See our Rewards Policy for full details.

**Are rewards guaranteed?**
No. Reward campaigns have limited slots and specific eligibility rules. Displayed items are illustrative, not guaranteed inventory.

**How do I redeem PalPoints?**
Visit a participating vendor and use the in-app QR redemption flow from your Wallet.

## Hidden Gems & Trips

**What is a Hidden Gem?**
A community-submitted place that may not appear on typical travel guides. Submissions are reviewed before being published.

**Can AI plan my trip?**
Yes — use the AI Itinerary feature to generate a personalized day-by-day plan based on your interests, budget, and pace.

## Vendor & Creator

**How do I become a Vendor?**
Apply from your Profile screen with your business details. Applications are reviewed by our team.

**How do I become a Creator?**
Apply from your Profile screen with a sample reel and social details. Applications are reviewed by our team.

## Privacy & Safety

**Does ${APP_NAME} sell my data?**
No. We never sell your personal data to advertisers or data brokers. See our Privacy Policy for full details on data use.

**How do I report inappropriate content?**
Use the "Report" option on any piece of content, or contact support directly.

## Still Need Help?
Visit **Settings → Help Center** or email us — see our Contact Information page.`,
  },
};

async function main() {
  const admin = await prisma.user.findFirst({
    where: { email: 'shivaay@palsafar.com' },
    select: { id: true },
  });

  let created = 0;
  let skipped = 0;

  for (const type of Object.keys(DOCUMENTS) as LegalDocumentType[]) {
    const { title, content } = DOCUMENTS[type];

    const document = await prisma.legalDocument.upsert({
      where: { type_locale: { type, locale: LOCALE } },
      update: {},
      create: { type, locale: LOCALE },
    });

    const existingPublished = await prisma.legalDocumentVersion.findFirst({
      where: { documentId: document.id, status: LegalVersionStatus.PUBLISHED },
    });

    if (existingPublished) {
      console.log(`[skip] ${type} already has a published version (v${existingPublished.versionNumber})`);
      skipped++;
      continue;
    }

    const version = await prisma.legalDocumentVersion.create({
      data: {
        documentId: document.id,
        versionNumber: 1,
        title,
        content,
        status: LegalVersionStatus.PUBLISHED,
        effectiveDate: EFFECTIVE_DATE,
        publishedAt: new Date(),
        changeSummary: 'Initial published version',
        createdById: admin?.id ?? null,
        publishedById: admin?.id ?? null,
      },
    });

    console.log(`[created] ${type} v${version.versionNumber} published`);
    created++;
  }

  console.log(`\nDone. Created: ${created}, Skipped (already published): ${skipped}`);
}

main()
  .catch((err) => {
    console.error('Legal document seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
