/**
 * Contacts & alerts surface (`/contacts`, including the alarm history).
 *
 * English and Hindi live side by side so a reviewer can check one string pair
 * at a time. `contactsHi` is typed against `contactsEn`, so a key added here
 * without a Hindi counterpart fails the build instead of silently falling back
 * to English in the middle of the page.
 *
 * Copy that came from a server or from stored data (provider policy steps,
 * relationship names, country names, vital labels) is not in this catalog: it
 * is data, and it is rendered as received.
 */
export const contactsEn = {
  "contacts.title": "Contacts & alerts",
  "contacts.subtitle": "Your trusted people and emergency calling preferences.",

  "contacts.emergencyHeading": "Emergency services",
  "contacts.country": "Country",
  "contacts.emergencyGeneral": "Emergency",
  "contacts.police": "Police",
  "contacts.ambulance": "Ambulance",
  "contacts.fire": "Fire",
  "contacts.emergencyNote":
    "AAPDA SETU never auto-dials or auto-sends to emergency services. During an alert you get one-tap call buttons{extra}. You place every call and press Send yourself.",
  "contacts.emergencyNoteSms":
    " and an SMS draft to {number} pre-filled with your location and medical details",
  "contacts.emergencySmsUnverified":
    "Emergency SMS in {country}: {note} Calling is the recommended option.",

  "contacts.personalHeading": "Personal contacts",
  "contacts.orderNote": "Order only organizes this list — there is no automatic escalation.",
  "contacts.accountPending": "Changes stay unsaved until you save to your account.",
  "contacts.deviceOnly": "Saved locally on this device.",
  "contacts.add": "Add",
  "contacts.empty":
    "No contacts yet. Add at least one person who should hear from you in an emergency.",
  "contacts.primary": "Primary",
  "contacts.confirmed": "Details self-confirmed",
  "contacts.unconfirmed": "Not confirmed — automatic contact will skip this person",
  "contacts.testDestination": "test destination",
  "contacts.channelCall": "Call",
  "contacts.channelSms": "SMS",
  "contacts.channelEmail": "Email",
  "contacts.moveUp": "Move up",
  "contacts.moveDown": "Move down",
  "contacts.edit": "Edit",
  "contacts.delete": "Delete",
  "contacts.removeConfirm": "Remove {name}?",
  "contacts.saveToAccount": "Save contacts to account",
  "contacts.saving": "Saving…",
  "contacts.signInToSave": "Sign in to save contacts privately across devices",
  "contacts.saved": "Contacts and consent saved to your private account.",
  "contacts.saveFailed": "Save failed. Try again.",
  "contacts.testNotice":
    "Opens a labelled test in your messaging app. You must press Send; delivery is not confirmed here.",
  "contacts.testAction": "Prepare test message",
  "contacts.testReason": "Test alert",
  "contacts.testReading": "checking AAPDA SETU works",

  "contacts.autoHeading": "Automatic emergency contact",
  "contacts.autoIntro":
    "After you deliberately raise an SOS, AAPDA SETU contacts the confirmed people below on the channels they enabled. It never calls emergency services for you.",
  "contacts.consent": "I consent to automatic contact after I raise SOS",
  "contacts.consentBody":
    "SMS and email go to everyone who enabled them. Automated calls follow the order above. You can withdraw consent here at any time.",
  "contacts.location": "Share my consented location in alert messages",
  "contacts.locationBody":
    "Only the last GPS fix at the moment of SOS, with its accuracy and age. Messages label a stale fix honestly.",
  "contacts.policy": "Default policy",
  "contacts.policy1":
    "SMS and email go to every contact who enabled them, as soon as you raise SOS.",
  "contacts.policy2":
    "Automated voice calls follow your contact order, starting with the first contact.",
  "contacts.policy3":
    "The next contact is tried after a provider failure or 30 seconds without an answer.",
  "contacts.policy4": "Unacknowledged attempts are retried once after 2 minutes.",
  "contacts.policy5":
    "Retries stop when you cancel the incident or a contact acknowledges it.",
  "contacts.policy6":
    "Emergency services are never called automatically. Use the call button yourself.",
  "contacts.providerMode": "Provider mode: {mode}. SMS {sms}, voice {voice}, email {email}.",
  "contacts.configured": "configured",
  "contacts.notConfigured": "not configured",
  "contacts.providerLive":
    "Live dispatch is enabled. Only contacts marked as real destinations are contacted.",
  "contacts.providerTest":
    "Test mode: no message or call leaves the server. Add provider credentials and set DISPATCH_MODE=live on the server for live sending.",
  "contacts.queueNote":
    "Queued escalation advances while the emergency screen is open. Background operation needs a scheduled job, which is not configured. Confirmation here is self-confirmation; no OTP or provider verification is configured yet.",

  "contacts.countdownHeading": "Cancel countdown",
  "contacts.instant": "Instant",
  "contacts.countdownBody":
    "Time to cancel before call and message actions appear. SOS opens those actions immediately.",
  "contacts.countdownAria": "Cancel countdown time",
  "contacts.countdownSeconds": "{count} seconds",

  "contacts.limitsHeading": "Critical limits",
  "contacts.reset": "Reset to defaults",
  "contacts.limitsBody":
    "These limits decide when an alarm fires — they are not medical advice. Talk to your doctor before changing them. Saved in this browser{account}.",
  "contacts.limitsAccount": " and your account",
  "contacts.colVital": "Vital",
  "contacts.colUnder": "Alarm under",
  "contacts.colOver": "Alarm over",
  "contacts.colSecond": "Second value",
  "contacts.lowerLimit": "{label} lower limit",
  "contacts.upperLimit": "{label} upper limit",
  "contacts.diastolicLimit": "Blood pressure diastolic upper limit",
  "contacts.rejected": "{error} — change rejected, the previous limit is kept.",

  "contacts.formEdit": "Edit contact",
  "contacts.formNew": "New contact",
  "contacts.formName": "Name",
  "contacts.formNameError": "Enter a name.",
  "contacts.formRelationship": "Relationship",
  "contacts.formPhone": "Phone (with country code)",
  "contacts.formPhoneError": "Enter a valid number, e.g. +91 98765 43210.",
  "contacts.formEmail": "Email (optional)",
  "contacts.formEmailError": "Enter a valid email address.",
  "contacts.formConfirm": "I have checked these details are correct",
  "contacts.formConfirmBody":
    "Self-confirmation only. Provider verification (OTP) is not configured, so AAPDA SETU cannot prove this address belongs to the contact.",
  "contacts.formTest": "Test destination",
  "contacts.formTestBody":
    "Recommended. A test destination never receives a live provider message, even when live dispatch is on.",
  "contacts.formSave": "Save contact",
  "contacts.formClose": "Close",

  "contacts.historyHeading": "Alarm history",
  "contacts.historyIntro":
    "Alarms are recorded here in test mode. Nothing in this list has been sent to anyone.",
  "contacts.historyRefresh": "Refresh",
  "contacts.historyError": "Alarm history could not be loaded. Try again.",
  "contacts.historyEmpty": "No alarms recorded yet.",
  "contacts.historyNoContacts": "No saved contacts were set to receive messages or calls.",
  "contacts.historyAttempt": "{channel} to {contact}",
  "contacts.demoBadge": "Demo",
  "contacts.testBadge": "Test mode",
} as const;

export type ContactsKey = keyof typeof contactsEn;

export const contactsHi: Record<ContactsKey, string> = {
  "contacts.title": "संपर्क और अलर्ट",
  "contacts.subtitle": "आपके भरोसेमंद लोग और आपातकालीन कॉल की प्राथमिकताएँ।",

  "contacts.emergencyHeading": "आपातकालीन सेवाएँ",
  "contacts.country": "देश",
  "contacts.emergencyGeneral": "आपातकाल",
  "contacts.police": "पुलिस",
  "contacts.ambulance": "एम्बुलेंस",
  "contacts.fire": "फायर",
  "contacts.emergencyNote":
    "आपदा सेतु कभी अपने आप आपातकालीन सेवाओं को कॉल या संदेश नहीं भेजता। अलर्ट के दौरान आपको एक-टैप कॉल बटन मिलते हैं{extra}। हर कॉल आप करते हैं और भेजें आप दबाते हैं।",
  "contacts.emergencyNoteSms":
    " और {number} पर एक SMS का मसौदा, जिसमें आपकी लोकेशन और चिकित्सीय जानकारी पहले से भरी होती है",
  "contacts.emergencySmsUnverified":
    "{country} में आपातकालीन SMS: {note} कॉल करना सुझाया गया विकल्प है।",

  "contacts.personalHeading": "व्यक्तिगत संपर्क",
  "contacts.orderNote": "क्रम केवल इस सूची को व्यवस्थित करता है — कोई स्वतः एस्केलेशन नहीं है।",
  "contacts.accountPending": "जब तक आप अपने खाते में सहेजते नहीं, बदलाव सहेजे नहीं जाते।",
  "contacts.deviceOnly": "इस डिवाइस पर स्थानीय रूप से सहेजा गया।",
  "contacts.add": "जोड़ें",
  "contacts.empty":
    "अभी कोई संपर्क नहीं। कम से कम एक व्यक्ति जोड़ें जिसे आपात स्थिति में आपकी खबर मिलनी चाहिए।",
  "contacts.primary": "प्राथमिक",
  "contacts.confirmed": "विवरण की स्वयं पुष्टि की गई",
  "contacts.unconfirmed": "पुष्ट नहीं — स्वतः संपर्क इस व्यक्ति को छोड़ देगा",
  "contacts.testDestination": "परीक्षण गंतव्य",
  "contacts.channelCall": "कॉल",
  "contacts.channelSms": "SMS",
  "contacts.channelEmail": "ईमेल",
  "contacts.moveUp": "ऊपर ले जाएँ",
  "contacts.moveDown": "नीचे ले जाएँ",
  "contacts.edit": "बदलें",
  "contacts.delete": "हटाएँ",
  "contacts.removeConfirm": "{name} को हटाएँ?",
  "contacts.saveToAccount": "संपर्क खाते में सहेजें",
  "contacts.saving": "सहेजा जा रहा है…",
  "contacts.signInToSave": "संपर्क निजी रूप से सभी डिवाइस पर सहेजने के लिए साइन इन करें",
  "contacts.saved": "संपर्क और सहमति आपके निजी खाते में सहेजे गए।",
  "contacts.saveFailed": "सहेजा नहीं गया। फिर कोशिश करें।",
  "contacts.testNotice":
    "यह आपके मैसेजिंग ऐप में लेबल किया गया परीक्षण खोलता है। भेजें आपको दबाना है; यहाँ डिलीवरी की पुष्टि नहीं होती।",
  "contacts.testAction": "परीक्षण संदेश तैयार करें",
  "contacts.testReason": "परीक्षण अलर्ट",
  "contacts.testReading": "आपदा सेतु काम कर रहा है या नहीं, यह जाँचा जा रहा है",

  "contacts.autoHeading": "स्वतः आपातकालीन संपर्क",
  "contacts.autoIntro":
    "आपके जानबूझकर SOS उठाने के बाद आपदा सेतु नीचे दिए पुष्ट संपर्कों से उनके चुने हुए चैनलों पर संपर्क करता है। यह आपकी ओर से कभी आपातकालीन सेवाओं को कॉल नहीं करता।",
  "contacts.consent": "SOS उठाने के बाद स्वतः संपर्क के लिए मैं सहमत हूँ",
  "contacts.consentBody":
    "SMS और ईमेल उन सभी को जाते हैं जिन्होंने इन्हें चालू किया है। स्वतः कॉल ऊपर दिए क्रम से होते हैं। आप यहाँ कभी भी सहमति वापस ले सकते हैं।",
  "contacts.location": "अलर्ट संदेशों में अपनी सहमत लोकेशन साझा करें",
  "contacts.locationBody":
    "केवल SOS के समय का अंतिम GPS फिक्स, उसकी सटीकता और उम्र के साथ। पुराने फिक्स को संदेशों में स्पष्ट रूप से बताया जाता है।",
  "contacts.policy": "डिफ़ॉल्ट नीति",
  "contacts.policy1":
    "जैसे ही आप SOS उठाते हैं, SMS और ईमेल उन सभी संपर्कों को जाते हैं जिन्होंने इन्हें चालू किया है।",
  "contacts.policy2": "स्वतः वॉइस कॉल आपके संपर्क क्रम से, पहले संपर्क से शुरू होकर, होते हैं।",
  "contacts.policy3":
    "प्रदाता विफल होने या 30 सेकंड तक उत्तर न मिलने पर अगले संपर्क को आज़माया जाता है।",
  "contacts.policy4": "बिना पुष्टि वाले प्रयास 2 मिनट बाद एक बार फिर आज़माए जाते हैं।",
  "contacts.policy5":
    "जब आप घटना रद्द करते हैं या कोई संपर्क पुष्टि करता है, तो दोबारा प्रयास रुक जाते हैं।",
  "contacts.policy6":
    "आपातकालीन सेवाओं को कभी अपने आप कॉल नहीं किया जाता। कॉल बटन आप स्वयं दबाएँ।",
  "contacts.providerMode": "प्रदाता मोड: {mode}। SMS {sms}, वॉइस {voice}, ईमेल {email}।",
  "contacts.configured": "कॉन्फ़िगर है",
  "contacts.notConfigured": "कॉन्फ़िगर नहीं है",
  "contacts.providerLive":
    "लाइव डिस्पैच चालू है। केवल वास्तविक गंतव्य के रूप में चिह्नित संपर्कों से संपर्क किया जाता है।",
  "contacts.providerTest":
    "परीक्षण मोड: कोई संदेश या कॉल सर्वर से बाहर नहीं जाता। लाइव भेजने के लिए प्रदाता क्रेडेंशियल जोड़ें और सर्वर पर DISPATCH_MODE=live सेट करें।",
  "contacts.queueNote":
    "कतारबद्ध एस्केलेशन तभी आगे बढ़ता है जब आपातकालीन स्क्रीन खुली हो। पृष्ठभूमि में चलाने के लिए निर्धारित जॉब चाहिए, जो कॉन्फ़िगर नहीं है। यहाँ की पुष्टि स्वयं-पुष्टि है; अभी कोई OTP या प्रदाता सत्यापन कॉन्फ़िगर नहीं है।",

  "contacts.countdownHeading": "रद्द करने की उलटी गिनती",
  "contacts.instant": "तुरंत",
  "contacts.countdownBody":
    "कॉल और संदेश क्रियाएँ दिखने से पहले रद्द करने का समय। SOS ये क्रियाएँ तुरंत खोलता है।",
  "contacts.countdownAria": "रद्द करने की उलटी गिनती का समय",
  "contacts.countdownSeconds": "{count} सेकंड",

  "contacts.limitsHeading": "गंभीर सीमाएँ",
  "contacts.reset": "डिफ़ॉल्ट पर लौटाएँ",
  "contacts.limitsBody":
    "ये सीमाएँ तय करती हैं कि अलार्म कब बजे — यह चिकित्सीय सलाह नहीं है। बदलने से पहले अपने डॉक्टर से बात करें। इस ब्राउज़र में सहेजा गया{account}।",
  "contacts.limitsAccount": " और आपके खाते में",
  "contacts.colVital": "माप",
  "contacts.colUnder": "कम पर अलार्म",
  "contacts.colOver": "ज़्यादा पर अलार्म",
  "contacts.colSecond": "दूसरा मान",
  "contacts.lowerLimit": "{label} की निचली सीमा",
  "contacts.upperLimit": "{label} की ऊपरी सीमा",
  "contacts.diastolicLimit": "रक्तचाप डायस्टोलिक की ऊपरी सीमा",
  "contacts.rejected": "{error} — बदलाव अस्वीकार किया गया, पिछली सीमा रखी गई है।",

  "contacts.formEdit": "संपर्क बदलें",
  "contacts.formNew": "नया संपर्क",
  "contacts.formName": "नाम",
  "contacts.formNameError": "नाम दर्ज करें।",
  "contacts.formRelationship": "रिश्ता",
  "contacts.formPhone": "फ़ोन (देश कोड के साथ)",
  "contacts.formPhoneError": "मान्य नंबर दर्ज करें, जैसे +91 98765 43210।",
  "contacts.formEmail": "ईमेल (वैकल्पिक)",
  "contacts.formEmailError": "मान्य ईमेल पता दर्ज करें।",
  "contacts.formConfirm": "मैंने जाँच लिया है कि ये विवरण सही हैं",
  "contacts.formConfirmBody":
    "केवल स्वयं-पुष्टि। प्रदाता सत्यापन (OTP) कॉन्फ़िगर नहीं है, इसलिए आपदा सेतु यह सिद्ध नहीं कर सकता कि यह पता उसी संपर्क का है।",
  "contacts.formTest": "परीक्षण गंतव्य",
  "contacts.formTestBody":
    "सुझाया गया। परीक्षण गंतव्य को लाइव प्रदाता संदेश कभी नहीं जाता, भले ही लाइव डिस्पैच चालू हो।",
  "contacts.formSave": "संपर्क सहेजें",
  "contacts.formClose": "बंद करें",

  "contacts.historyHeading": "अलार्म इतिहास",
  "contacts.historyIntro":
    "परीक्षण मोड में अलार्म यहाँ दर्ज होते हैं। इस सूची में से कुछ भी किसी को नहीं भेजा गया है।",
  "contacts.historyRefresh": "रीफ़्रेश करें",
  "contacts.historyError": "अलार्म इतिहास लोड नहीं हो सका। फिर कोशिश करें।",
  "contacts.historyEmpty": "अभी कोई अलार्म दर्ज नहीं है।",
  "contacts.historyNoContacts": "कोई सहेजा गया संपर्क संदेश या कॉल पाने के लिए सेट नहीं था।",
  "contacts.historyAttempt": "{channel} — {contact} को",
  "contacts.demoBadge": "डेमो",
  "contacts.testBadge": "परीक्षण मोड",
};
