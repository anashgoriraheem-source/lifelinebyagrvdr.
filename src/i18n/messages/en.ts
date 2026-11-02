/**
 * English message catalog — the reference pack. Every key used by the
 * localized shell, translator, assistant and emergency surfaces lives here.
 * New locales may translate any subset; missing keys fall back to English.
 */
export const en = {
  "nav.home": "Home",
  "nav.monitor": "Monitor",
  "nav.assistant": "Assistant",
  "nav.translate": "Translate",
  "nav.contacts": "Contacts",
  "nav.account": "Account",
  "nav.more": "More",
  "nav.primary": "Primary navigation",

  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.close": "Close",
  "common.retry": "Try again",
  "common.copy": "Copy",
  "common.copied": "Copied",
  "common.loading": "Loading…",
  "common.error": "Something went wrong. Try again.",
  "common.notAvailable": "Not available",
  "common.language": "Language",
  "common.optional": "Optional",

  "lang.label": "App language",
  "lang.preview": "Preview language",
  "lang.status.complete": "Complete interface pack",
  "lang.status.machine-draft":
    "Machine-drafted interface pack — not reviewed by a fluent speaker. Translated here: navigation, the assistant, the translator and their safety notices. Contacts, account, monitor detail and the emergency overlay stay in English, and emergency/first-aid wording is always English until a qualified reviewer signs it off.",
  "lang.status.partial": "Partly translated — English shown for missing text",
  "lang.safetyUnreviewed":
    "Safety wording has not been reviewed in this language. English safety text is shown below and emergency calling stays available.",
  "lang.coverage": "{done}% of interface strings translated",
  "lang.missing": "{count} interface strings still fall back to English",

  "safety.callEmergency": "Call emergency services",
  "safety.notMedicalDevice":
    "Lifeline is an emergency-support tool, not a medical device or a replacement for professional care.",
  "safety.demoData": "Demo data — not your health readings",
  "safety.noAutoDispatch": "Lifeline never calls emergency services for you.",
  "safety.alertActive": "Alert active",

  "chat.title": "Lifeline assistant",
  "chat.subtitle":
    "Health information and first aid, grounded in Lifeline’s sources and your own records.",
  "chat.placeholder": "Ask about first aid, your readings or your setup",
  "chat.send": "Send message",
  "chat.thinking": "Looking through your Lifeline records and sources…",
  "chat.empty": "Ask a question, or choose a starting point below.",
  "chat.unavailable":
    "The language model is not configured on this deployment. Showing vetted first-aid guidance and your own records instead.",
  "chat.sources": "Sources",
  "chat.escalationTitle": "This may be life-threatening",
  "chat.escalationBody":
    "Call your local emergency number now. Do not wait for the assistant, and do not rely on messages to contacts alone.",
  "chat.voiceStart": "Read answers aloud",
  "chat.voiceStop": "Stop reading",
  "chat.voiceUnavailable":
    "No voice is available for this language on this device. The text answer is still shown.",
  "chat.listening": "Listening…",
  "chat.languageOverride": "Answer language",
  "chat.attach": "Attach an image",
  "chat.edit": "Edit my last question",
  "chat.library": "Search Lifeline’s health library",
  "chat.libraryOn": "Searching Lifeline’s health library",
  "chat.attached": "Image attached",
  "chat.removeImage": "Remove image",
  "chat.imageTooLarge": "Choose a PNG, JPEG or WebP image under 2 MB.",
  "chat.actions": "Message actions",
  "chat.attachUnsupported":
    "Images cannot be read by the configured model. Describe the situation in words instead.",
  "chat.signedOut": "Signed out — answers use this device only.",
  "chat.groundedIn": "Based on",
  "chat.recordProfile": "your saved safety profile",
  "chat.recordContacts": "your saved emergency contacts",
  "chat.recordReadings": "your latest device readings",
  "chat.recordIncidents": "your recent incidents",
  "chat.noPersonalData": "No personal records are saved to your account yet.",
  "chat.disclaimer":
    "General information, not a diagnosis. Emergency instructions from a dispatcher always take priority.",

  "translate.title": "Translate",
  "translate.subtitle":
    "Translate between the languages offered by the configured translation service. Interface language and translation language are separate.",
  "translate.from": "From",
  "translate.to": "To",
  "translate.detect": "Detect language",
  "translate.input": "Text to translate",
  "translate.output": "Translation",
  "translate.action": "Translate",
  "translate.copy": "Copy translation",
  "translate.listen": "Read translation aloud",
  "translate.machine": "Machine translated — not reviewed by a human translator.",
  "translate.unavailable":
    "No translation service is configured on this deployment. Add the provider credentials on the server to enable translation.",
  "translate.auto": "Auto-detected",
  "translate.empty": "Enter text to translate.",
  "translate.tooLong": "Keep the text under {max} characters.",
  "translate.failed": "Translation failed. Check the service status and try again.",

  "status.receiving": "Receiving readings",
  "status.waiting": "Waiting for readings",
  "status.inactive": "Monitoring inactive",
  "status.demo": "Demo mode",

  "device.title": "Devices",
  "device.supported": "Web Bluetooth is available in this browser.",
  "device.unsupported":
    "This browser does not support Web Bluetooth. Use Chrome or Edge on Android, Windows, macOS or ChromeOS.",
  "device.secureContext": "Bluetooth requires a secure (HTTPS) connection.",

  "med.title": "Non-prescription medicine information",
  "med.subtitle":
    "Generic information only. Lifeline never states a dose, never suggests a prescription medicine, and is not a diagnosis.",
  "med.disabledHeading": "Medicine suggestions are not enabled",
  "med.emergencyHeading": "Emergency help comes first",
  "med.refusedHeading": "Not offered for this situation",
  "med.informationHeading": "Reference information",
  "med.question": "Which medicine is this about?",
  "med.questionPlaceholder": "For example: can I take paracetamol for a mild headache?",
  "med.age": "Age in years",
  "med.pregnancy": "Pregnancy or breastfeeding",
  "med.notGiven": "Prefer not to say / not given",
  "med.notPregnant": "Not pregnant or breastfeeding",
  "med.pregnant": "Pregnant",
  "med.breastfeeding": "Breastfeeding",
  "med.allergies": "Allergies",
  "med.conditions": "Health conditions",
  "med.currentMeds": "Current medicines, including anything bought without a prescription",
  "med.commaHint": "Separate entries with commas",
  "med.check": "Check safety factors",
  "med.labelOnly": "Dosing: follow your product label or a pharmacist. Lifeline does not calculate a dose.",
  "med.genericOnly": "generic name only, no brands",
  "med.factorsChecked": "Safety factors checked",
  "med.referenceSummary": "Reference catalogue · version {version}",
  "med.jurisdiction": "Jurisdiction",
  "med.reviewed": "Clinically reviewed",
  "med.notReviewed": "Not clinically reviewed — guidance disabled",
  "med.interactions": "Interacts with",
  "med.disclaimer":
    "General information only, not a diagnosis or a prescription. Always follow the product label and ask a pharmacist or clinician when unsure.",

  "voice.title": "Voice support on this device",
  "voice.subtitle":
    "What this browser can speak and listen to. Missing voices or recognition do not remove the text answer.",
  "voice.pause": "Pause reading",
  "voice.resume": "Resume reading",
  "voice.replay": "Read again",
  "voice.textOnly": "Text only",
  "voice.deviceVoices": "{count} device voices match the selected language",
  "voice.noMatchingVoice":
    "No device voice matches this language. The answer stays readable as text; another language may have a voice.",
  "voice.inputUnavailable":
    "Voice input is not available in this browser. Typing stays available for every language.",
  "voice.inputAvailable":
    "Voice input is available in this browser. Recognition language coverage still depends on the browser and is not guaranteed for every language.",
  "voice.none": "No device voice",
  "voice.testedNote":
    "Voice support depends on the operating system and browser voice pack. Language coverage is reported per language above, not assumed.",

  "sources.title": "Sources and review status",
  "sources.version": "Knowledge base version {version}",
  "sources.lastChecked": "Sources last checked {date}",
  "sources.reviewStatus": "Clinical review status",
  "sources.notReviewedNote":
    "Guidance is paraphrased from the listed public-health sources. It has not been reviewed by a clinician in this build.",

  "onboarding.title": "Choose your language",
  "onboarding.body":
    "You can change this at any time from the header or in Settings. Interface translation and machine translation on the Translate page are separate.",
  "onboarding.confirm": "Continue in {language}",

  "translate.providerTitle": "Languages offered by the translation provider",
  "translate.providerNone":
    "No translation provider is configured, so no language is listed as available.",
  "translate.providerModel":
    "The configured model adapter has no verified language catalogue. Translations are attempted per request and reported as machine translated.",
  "translate.translateOnly": "Translation only — no interface pack",
  "translate.interfacePack": "Interface in this language",
  "translate.stop": "Stop reading",
  "translate.replay": "Read again",
  "translate.detected": "Detected source language",

  "a11y.languageChanged": "Interface language changed to {language}.",

  "hero.specsLabel": "What Lifeline shows",
  "hero.eyebrow": "Lifeline · Aapda Setu",
  "hero.tagline": "Personal safety companion",
  "hero.statusIdle": "Standing by · nothing is sent automatically",
  "hero.statusActive": "Tile {id} · standing by",
  "hero.specReadings": "Readings",
  "hero.specReadingsValue": "Only from your device",
  "hero.specAlerts": "Alerts",
  "hero.specAlertsValue": "Only with your confirmation",
  "hero.specLanguages": "Languages",
  "hero.specLanguagesValue": "English · हिन्दी",
  "hero.titleLine1": "Help within reach",
  "hero.titleLine2": "when seconds count.",
  "hero.cta": "Set up a device",

  "device.connect.title": "Connect a health device",
  "device.connect.intro":
    "Lifeline can show readings from some Bluetooth health devices. Nothing on this page is sent to anyone, and you can use every other feature without a device.",
  "device.connect.stepsHeading": "Before you start",
  "device.connect.step1":
    "Use Chrome or Edge on Android, Windows, Mac or a Chromebook. iPhones and iPads cannot connect here.",
  "device.connect.step2": "Keep the page secure — the address bar should show a padlock.",
  "device.connect.step3":
    "Switch the device on, charge it, and keep it within about one metre of this phone or computer.",
  "device.connect.step4":
    "If your device has a “share” or “broadcast” setting, switch it on so it can be found.",
  "device.connect.ready": "This browser can connect. Ready when you are.",
  "device.connect.unsupported":
    "This browser cannot connect to health devices. Everything else on this page still works — you can add contacts and open first-aid guidance.",
  "device.connect.insecure":
    "Bluetooth needs a secure page. Open Lifeline again with https:// at the start of the address.",
  "device.connect.action": "Open the device list",
  "device.connect.actionHint":
    "Your browser will open its own list of nearby devices. Choose your device there and allow Bluetooth if you are asked.",
  "device.connect.statusIdle": "No device connected",
  "device.connect.statusOpening": "Opening your browser’s device list",
  "device.connect.statusConnecting": "Connecting to {name}. This can take a few seconds.",
  "device.connect.statusConnected":
    "Connected to {name}. Waiting for a reading — open the device’s own app or take a measurement if nothing appears.",
  "device.connect.statusReceiving": "Receiving readings from {name}.",
  "device.connect.statusLost": "The connection to {name} was lost.",
  "device.connect.cancelled":
    "No device was chosen, so nothing has changed. Try again whenever you are ready.",
  "device.connect.denied":
    "Permission was blocked. Allow Bluetooth for this site in your browser settings, then try again.",
  "device.connect.rangeError":
    "The device could not be reached. Move it closer, make sure it is switched on, and try again.",
  "device.connect.incompatible":
    "This device does not share heart rate, oxygen, blood pressure or glucose readings with Lifeline.",
  "device.connect.failed":
    "The connection did not work. Check that the device is switched on and nearby, then try again.",
  "device.connect.disconnect": "Disconnect device",
  "device.connect.without": "Continue without a device",
  "device.connect.skipped":
    "You can keep using Lifeline without a device. Your emergency contacts and the first-aid guidance stay available.",
  "device.connect.showSteps": "Show the steps again",
  "device.connect.firstAid": "Open first-aid guidance",
  "device.connect.limitsTitle": "What a connection can and cannot do",
  "device.connect.limitReadings":
    "Not every device shares every reading. Only the measurements your device sends will appear.",
  "device.connect.limitManual":
    "Some blood pressure cuffs and glucose meters send a reading only after you take a measurement.",
  "device.connect.limitBackground":
    "Lifeline cannot reconnect by itself, measure in the background, or reach anyone after this page is closed.",
  "device.connect.technicalTitle": "Technical details",
  "device.connect.technicalBody":
    "Lifeline asks the browser for these standard Bluetooth services: Heart Rate (0x180D), Pulse Oximeter (0x1822), Blood Pressure (0x1810) and Glucose (0x1808). No device list leaves your device.",
} as const;

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;
