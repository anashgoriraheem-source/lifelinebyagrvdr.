import { releaseHi } from "./release";
/**
 * Locale packs.
 *
 * `hi` is a complete Hindi pack for the localized surfaces: every key in
 * `messages/en.ts` has an entry, so no screen silently falls back to English
 * mid-flow. It is still labelled machine-drafted and its safety wording is NOT
 * reviewed — see `locales.ts` and `coverage.ts`. Emergency and first-aid
 * wording therefore stays in English until a qualified Hindi-speaking
 * clinician/translator record exists.
 *
 * Screens that are not yet part of the catalog (the alarm overlay and the
 * monitor readings detail) are single-language and stay in English; that is
 * reported to the user in the language picker, not hidden.
 */
import type { LocaleCode } from "../locales";
import { accountHi } from "./account";
import { contactsHi } from "./contacts";
import type { MessageKey } from "./en";

export type Pack = Partial<Record<MessageKey, string>>;

const hi: Pack = {
  "nav.home": "होम",
  "nav.monitor": "मॉनिटर",
  "nav.assistant": "सहायक",
  "nav.translate": "अनुवाद",
  "nav.contacts": "संपर्क",
  "nav.account": "खाता",
  "nav.more": "और",
  "nav.primary": "मुख्य नेविगेशन",

  "common.save": "सहेजें",
  "common.cancel": "रद्द करें",
  "common.close": "बंद करें",
  "common.retry": "फिर कोशिश करें",
  "common.copy": "कॉपी करें",
  "common.copied": "कॉपी हो गया",
  "common.loading": "लोड हो रहा है…",
  "common.error": "कुछ गड़बड़ हो गई। फिर कोशिश करें।",
  "common.notAvailable": "उपलब्ध नहीं",
  "common.language": "भाषा",
  "common.optional": "वैकल्पिक",

  "lang.label": "ऐप की भाषा",
  "lang.preview": "भाषा का पूर्वावलोकन",
  "lang.status.complete": "ऐप का सहेजा हुआ पाठ — समीक्षा बाकी है",
  "lang.status.machine-draft":
    "हिन्दी पाठ मशीन-तैयार मसौदा है। धाराप्रवाह वक्ता और चिकित्सा समीक्षक की स्वीकृति नहीं मिली है। प्राथमिक चिकित्सा के निर्देश और Saath की कुछ प्रविष्टियाँ अंग्रेज़ी में स्पष्ट भाषा नोट के साथ हैं। प्रतिशत केवल सूचीबद्ध पाठ का है, पूरे ऐप की समीक्षा का नहीं।",
  "lang.status.partial": "आंशिक अनुवाद — छूटा हुआ पाठ अंग्रेज़ी में दिखेगा",
  "lang.safetyUnreviewed":
    "इस भाषा में सुरक्षा से जुड़े शब्दों की समीक्षा नहीं हुई है। सुरक्षा और प्राथमिक चिकित्सा का पाठ अंग्रेज़ी में दिखाया जाता है, और आपातकालीन कॉल हमेशा उपलब्ध रहता है।",
  "lang.coverage": "सूचीबद्ध पाठ के {done}% के लिए अनुवाद की प्रविष्टि है",
  "lang.missing": "{count} इंटरफ़ेस पाठ अभी भी अंग्रेज़ी में दिखते हैं",

  "safety.callEmergency": "आपातकालीन सेवाओं को कॉल करें",
  "safety.notMedicalDevice":
    "लाइफलाइन एक आपातकालीन सहायता उपकरण है, चिकित्सा उपकरण नहीं, और पेशेवर देखभाल का विकल्प नहीं है।",
  "safety.demoData": "डेमो डेटा — ये आपकी स्वास्थ्य रीडिंग नहीं हैं",
  "safety.noAutoDispatch": "लाइफलाइन आपकी ओर से कभी आपातकालीन सेवाओं को कॉल नहीं करता।",
  "safety.alertActive": "अलर्ट सक्रिय है",

  "chat.title": "लाइफलाइन सहायक",
  "chat.subtitle":
    "स्वास्थ्य जानकारी और प्राथमिक चिकित्सा, लाइफलाइन के स्रोतों और आपके अपने रिकॉर्ड के आधार पर।",
  "chat.placeholder": "प्राथमिक चिकित्सा, अपनी रीडिंग या सेटअप के बारे में पूछें",
  "chat.send": "संदेश भेजें",
  "chat.thinking": "आपके लाइफलाइन रिकॉर्ड और स्रोतों में देखा जा रहा है…",
  "chat.empty": "कोई सवाल पूछें, या नीचे दिए विकल्पों में से एक चुनें।",
  "chat.unavailable":
    "इस डिप्लॉयमेंट पर भाषा मॉडल कॉन्फ़िगर नहीं है। इसके बजाय जाँची गई प्राथमिक चिकित्सा जानकारी और आपके रिकॉर्ड दिखाए जा रहे हैं।",
  "chat.sources": "स्रोत",
  "chat.escalationTitle": "यह जानलेवा हो सकता है",
  "chat.escalationBody":
    "अभी अपने स्थानीय आपातकालीन नंबर पर कॉल करें। सहायक का इंतज़ार न करें, और केवल संपर्कों को भेजे गए संदेशों पर निर्भर न रहें।",
  "chat.voiceStart": "उत्तर पढ़कर सुनाएँ",
  "chat.voiceStop": "पढ़ना बंद करें",
  "chat.voiceUnavailable":
    "इस डिवाइस पर इस भाषा के लिए कोई आवाज़ उपलब्ध नहीं है। उत्तर पाठ में अभी भी पढ़ा जा सकता है।",
  "chat.listening": "सुन रहे हैं…",
  "chat.languageOverride": "उत्तर की भाषा",
  "chat.attach": "चित्र जोड़ें",
  "chat.edit": "मेरा पिछला सवाल बदलें",
  "chat.library": "लाइफलाइन स्वास्थ्य पुस्तकालय में खोजें",
  "chat.libraryOn": "लाइफलाइन स्वास्थ्य पुस्तकालय में खोजा जा रहा है",
  "chat.attached": "चित्र जोड़ा गया",
  "chat.removeImage": "चित्र हटाएँ",
  "chat.imageTooLarge": "2 MB से छोटी PNG, JPEG या WebP छवि चुनें।",
  "chat.actions": "संदेश की क्रियाएँ",
  "chat.attachUnsupported":
    "कॉन्फ़िगर किया गया मॉडल चित्र नहीं पढ़ सकता। स्थिति को शब्दों में बताएँ।",
  "chat.signedOut": "साइन आउट हैं — उत्तर केवल इस डिवाइस के डेटा का उपयोग करते हैं।",
  "chat.groundedIn": "आधार",
  "chat.recordProfile": "आपकी सहेजी गई सुरक्षा प्रोफ़ाइल",
  "chat.recordContacts": "आपके सहेजे गए आपातकालीन संपर्क",
  "chat.recordReadings": "आपकी नवीनतम डिवाइस रीडिंग",
  "chat.recordIncidents": "आपकी हाल की घटनाएँ",
  "chat.noPersonalData": "आपके खाते में अभी कोई निजी रिकॉर्ड सहेजा नहीं गया है।",
  "chat.disclaimer":
    "यह सामान्य जानकारी है, निदान नहीं। डिस्पैचर के आपातकालीन निर्देश हमेशा प्राथमिकता पाएँगे।",

  "translate.title": "अनुवाद",
  "translate.subtitle":
    "कॉन्फ़िगर की गई अनुवाद सेवा द्वारा दी गई भाषाओं के बीच अनुवाद करें। इंटरफ़ेस की भाषा और अनुवाद की भाषा अलग-अलग हैं।",
  "translate.from": "से",
  "translate.to": "में",
  "translate.detect": "भाषा पहचानें",
  "translate.input": "अनुवाद करने का पाठ",
  "translate.output": "अनुवाद",
  "translate.action": "अनुवाद करें",
  "translate.copy": "अनुवाद कॉपी करें",
  "translate.listen": "अनुवाद पढ़कर सुनाएँ",
  "translate.machine": "मशीन द्वारा अनुवादित — मानव अनुवादक ने समीक्षा नहीं की।",
  "translate.unavailable":
    "ऑनलाइन अनुवाद उपलब्ध नहीं है। ऐप की सहेजी अंग्रेज़ी और हिन्दी भाषा फिर भी उपयोग कर सकते हैं। इसे चालू करने से पहले संचालक को अनुवाद सेवा सेट करके जाँचनी होगी।",
  "translate.auto": "स्वतः पहचानी गई भाषा",
  "translate.empty": "अनुवाद के लिए पाठ लिखें।",
  "translate.tooLong": "पाठ {max} अक्षरों से कम रखें।",
  "translate.failed": "अनुवाद नहीं हो सका। सेवा की स्थिति देखें और फिर कोशिश करें।",

  "status.receiving": "रीडिंग प्राप्त हो रही हैं",
  "status.waiting": "रीडिंग की प्रतीक्षा है",
  "status.inactive": "मॉनिटरिंग बंद है",
  "status.demo": "डेमो मोड",

  "device.title": "डिवाइस",
  "device.supported": "इस ब्राउज़र में Web Bluetooth उपलब्ध है।",
  "device.unsupported":
    "यह ब्राउज़र Web Bluetooth का समर्थन नहीं करता। Android, Windows, macOS या ChromeOS पर Chrome या Edge का उपयोग करें।",
  "device.secureContext": "Bluetooth के लिए सुरक्षित (HTTPS) कनेक्शन ज़रूरी है।",

  "med.title": "बिना पर्चे मिलने वाली दवाओं की जानकारी",
  "med.subtitle":
    "केवल सामान्य जानकारी। लाइफलाइन कभी खुराक नहीं बताता, कोई पर्चे वाली दवा नहीं सुझाता, और निदान नहीं करता।",
  "med.disabledHeading": "दवा सुझाव चालू नहीं हैं",
  "med.emergencyHeading": "पहले आपातकालीन मदद",
  "med.refusedHeading": "इस स्थिति के लिए सुझाव नहीं दिया गया",
  "med.informationHeading": "संदर्भ जानकारी",
  "med.question": "किस दवा के बारे में पूछना है?",
  "med.questionPlaceholder": "जैसे: हल्के सिरदर्द के लिए क्या मैं पैरासिटामोल ले सकता/सकती हूँ?",
  "med.age": "उम्र (वर्ष)",
  "med.pregnancy": "गर्भावस्था या स्तनपान",
  "med.notGiven": "नहीं बताना चाहते",
  "med.notPregnant": "गर्भवती या स्तनपान कराने वाली नहीं",
  "med.pregnant": "गर्भवती",
  "med.breastfeeding": "स्तनपान कराने वाली",
  "med.allergies": "एलर्जी",
  "med.conditions": "स्वास्थ्य स्थितियाँ",
  "med.currentMeds": "अभी ली जा रही दवाएँ, बिना पर्चे खरीदी गई दवाएँ भी शामिल",
  "med.commaHint": "हर प्रविष्टि को अल्पविराम से अलग करें",
  "med.check": "सुरक्षा कारक जाँचें",
  "med.labelOnly":
    "खुराक: अपने उत्पाद के लेबल या फ़ार्मासिस्ट की सलाह मानें। लाइफलाइन खुराक नहीं निकालता।",
  "med.genericOnly": "केवल सामान्य नाम, कोई ब्रांड नहीं",
  "med.factorsChecked": "सुरक्षा कारक जाँचे गए",
  "med.referenceSummary": "संदर्भ सूची · संस्करण {version}",
  "med.jurisdiction": "कानूनी क्षेत्राधिकार",
  "med.reviewed": "चिकित्सकीय रूप से समीक्षित",
  "med.notReviewed": "चिकित्सकीय समीक्षा नहीं हुई — मार्गदर्शन बंद है",
  "med.interactions": "इनके साथ परस्पर क्रिया",
  "med.disclaimer":
    "केवल सामान्य जानकारी, निदान या पर्चा नहीं। हमेशा उत्पाद का लेबल मानें और संदेह होने पर फ़ार्मासिस्ट या चिकित्सक से पूछें।",

  "voice.title": "इस डिवाइस पर आवाज़ सहायता",
  "voice.subtitle":
    "यह ब्राउज़र क्या बोल और सुन सकता है। आवाज़ या श्रवण उपलब्ध न होने पर भी लिखित उत्तर बना रहता है।",
  "voice.pause": "पढ़ना रोकें",
  "voice.resume": "पढ़ना जारी रखें",
  "voice.replay": "फिर पढ़ें",
  "voice.textOnly": "केवल पाठ",
  "voice.deviceVoices": "चुनी गई भाषा के लिए {count} डिवाइस आवाज़ें मिलीं",
  "voice.noMatchingVoice":
    "इस भाषा से मेल खाती कोई डिवाइस आवाज़ नहीं है। उत्तर पाठ में पढ़ा जा सकता है; किसी दूसरी भाषा की आवाज़ उपलब्ध हो सकती है।",
  "voice.inputUnavailable":
    "इस ब्राउज़र में आवाज़ से लिखना उपलब्ध नहीं है। हर भाषा में टाइप करके लिखा जा सकता है।",
  "voice.inputAvailable":
    "इस ब्राउज़र में आवाज़ से लिखना उपलब्ध है। पहचान की भाषा कवरेज ब्राउज़र पर निर्भर है और हर भाषा के लिए निश्चित नहीं है।",
  "voice.none": "कोई डिवाइस आवाज़ नहीं",
  "voice.testedNote":
    "आवाज़ सहायता ऑपरेटिंग सिस्टम और ब्राउज़र के आवाज़ पैक पर निर्भर है। भाषा कवरेज ऊपर हर भाषा के लिए बताई गई है, मानी नहीं गई।",

  "sources.title": "स्रोत और समीक्षा की स्थिति",
  "sources.version": "ज्ञान आधार संस्करण {version}",
  "sources.lastChecked": "स्रोत अंतिम बार {date} को जाँचे गए",
  "sources.reviewStatus": "चिकित्सकीय समीक्षा की स्थिति",
  "sources.notReviewedNote":
    "मार्गदर्शन सूचीबद्ध सार्वजनिक स्वास्थ्य स्रोतों से अपने शब्दों में लिखा गया है। इस बिल्ड में किसी चिकित्सक ने इसकी समीक्षा नहीं की है।",

  "onboarding.title": "अपनी भाषा चुनें",
  "onboarding.body":
    "आप इसे कभी भी हेडर से या सेटिंग्स में बदल सकते हैं। इंटरफ़ेस का अनुवाद और अनुवाद पेज पर मशीन अनुवाद अलग-अलग हैं।",
  "onboarding.confirm": "{language} में जारी रखें",

  "translate.providerTitle": "अनुवाद प्रदाता द्वारा दी गई भाषाएँ",
  "translate.providerNone":
    "कोई अनुवाद प्रदाता कॉन्फ़िगर नहीं है, इसलिए कोई भाषा उपलब्ध के रूप में नहीं दिखाई गई है।",
  "translate.providerModel":
    "कॉन्फ़िगर किए गए मॉडल एडाप्टर के पास सत्यापित भाषा सूची नहीं है। हर अनुरोध पर अनुवाद का प्रयास होता है और उसे मशीन अनुवाद बताया जाता है।",
  "translate.translateOnly": "केवल अनुवाद — कोई इंटरफ़ेस पैक नहीं",
  "translate.interfacePack": "इस भाषा में इंटरफ़ेस",
  "translate.stop": "पढ़ना बंद करें",
  "translate.replay": "फिर पढ़ें",
  "translate.detected": "पहचानी गई स्रोत भाषा",

  "a11y.languageChanged": "इंटरफ़ेस की भाषा {language} कर दी गई है।",

  "hero.specsLabel": "लाइफलाइन क्या दिखाता है",
  "hero.eyebrow": "लाइफलाइन · आपदा सेतु",
  "hero.tagline": "आपका सुरक्षा साथी",
  "hero.statusIdle": "तैयार · कुछ भी अपने आप नहीं भेजा जाता",
  "hero.statusActive": "टाइल {id} · तैयार",
  "hero.specReadings": "रीडिंग",
  "hero.specReadingsValue": "केवल आपके डिवाइस से",
  "hero.specAlerts": "अलर्ट",
  "hero.specAlertsValue": "केवल आपकी पुष्टि से",
  "hero.specLanguages": "भाषाएँ",
  "hero.specLanguagesValue": "English · हिन्दी",
  "hero.titleLine1": "मदद पास, जब",
  "hero.titleLine2": "हर पल मायने रखे।",
  "hero.cta": "डिवाइस जोड़ें",

  "device.connect.title": "स्वास्थ्य डिवाइस जोड़ें",
  "device.connect.intro":
    "लाइफलाइन कुछ ब्लूटूथ स्वास्थ्य डिवाइसों की रीडिंग दिखा सकता है। इस पेज से कुछ भी किसी को नहीं भेजा जाता, और डिवाइस के बिना भी बाकी सब सुविधाएँ चलती रहती हैं।",
  "device.connect.stepsHeading": "शुरू करने से पहले",
  "device.connect.step1":
    "डिवाइस जोड़ने वाला ब्राउज़र आज़माएँ, जैसे Android या कंप्यूटर पर Chrome। iPhone या iPad के Safari में यह सुविधा नहीं है। उपलब्धता ब्राउज़र और डिवाइस पर निर्भर है।",
  "device.connect.step2":
    "वेबसाइट के पते की शुरुआत https:// से होनी चाहिए। ब्राउज़र Bluetooth की अनुमति भी माँग सकता है।",
  "device.connect.step3":
    "डिवाइस चालू करें, चार्ज रखें, और इसे इस फ़ोन या कंप्यूटर से लगभग एक मीटर के भीतर रखें।",
  "device.connect.step4":
    "अगर आपके डिवाइस में “साझा करें” या “ब्रॉडकास्ट” सेटिंग है, तो उसे चालू करें ताकि वह खोजा जा सके।",
  "device.connect.ready":
    "इस ब्राउज़र में डिवाइस जोड़ने की सुविधा है। आपके स्वास्थ्य डिवाइस के साथ संगतता की पुष्टि नहीं हुई है।",
  "device.connect.unsupported":
    "यह ब्राउज़र स्वास्थ्य डिवाइस से नहीं जुड़ सकता। इस पेज की बाकी सब चीज़ें चलती रहेंगी — आप संपर्क जोड़ सकते हैं और प्राथमिक चिकित्सा मार्गदर्शन खोल सकते हैं।",
  "device.connect.insecure":
    "ब्लूटूथ के लिए सुरक्षित पेज ज़रूरी है। ऐड्रेस के शुरू में https:// के साथ लाइफलाइन फिर खोलें।",
  "device.connect.action": "डिवाइस की सूची खोलें",
  "device.connect.actionHint":
    "आपका ब्राउज़र पास के डिवाइसों की अपनी सूची खोलेगा। वहाँ अपना डिवाइस चुनें और पूछे जाने पर ब्लूटूथ की अनुमति दें।",
  "device.connect.statusIdle": "कोई डिवाइस नहीं जुड़ा",
  "device.connect.statusOpening": "आपके ब्राउज़र की डिवाइस सूची खुल रही है",
  "device.connect.statusConnecting": "{name} से जुड़ रहे हैं। इसमें कुछ सेकंड लग सकते हैं।",
  "device.connect.statusConnected":
    "{name} से जुड़ गया। रीडिंग का इंतज़ार है। ज़रूरत हो तो डिवाइस पर माप लें। दूसरा ऐप डिवाइस का उपयोग कर रहा हो तो साझा करना रुक सकता है।",
  "device.connect.statusReceiving": "{name} से रीडिंग आ रही हैं।",
  "device.connect.statusLost":
    "{name} का कनेक्शन टूट गया। पास और चालू रखकर डिवाइस सूची फिर खोलें। नई रीडिंग नहीं मिल रही है।",
  "device.connect.cancelled":
    "कोई डिवाइस नहीं चुना गया, इसलिए कुछ नहीं बदला। जब चाहें फिर कोशिश करें।",
  "device.connect.denied":
    "अनुमति रोक दी गई। ब्राउज़र सेटिंग्स में इस साइट के लिए ब्लूटूथ की अनुमति दें, फिर कोशिश करें।",
  "device.connect.rangeError":
    "डिवाइस तक नहीं पहुँच सके। उसे और पास रखें, जाँचें कि वह चालू है, और फिर कोशिश करें।",
  "device.connect.incompatible":
    "इस डिवाइस से उपयुक्त रीडिंग नहीं मिली। इसकी साझा करने की विधि अलग हो सकती है। फिर कोशिश करें या इसके बिना आगे बढ़ें।",
  "device.connect.failed": "कनेक्शन नहीं बना। जाँचें कि डिवाइस चालू और पास है, फिर कोशिश करें।",
  "device.connect.disconnect": "डिवाइस डिस्कनेक्ट करें",
  "device.connect.without": "डिवाइस के बिना आगे बढ़ें",
  "device.connect.skipped":
    "आप डिवाइस के बिना भी लाइफलाइन इस्तेमाल कर सकते हैं। आपके आपातकालीन संपर्क और प्राथमिक चिकित्सा मार्गदर्शन उपलब्ध रहते हैं।",
  "device.connect.showSteps": "चरण फिर दिखाएँ",
  "device.connect.firstAid": "प्राथमिक चिकित्सा मार्गदर्शन खोलें",
  "device.connect.limitsTitle": "कनेक्शन क्या कर सकता है और क्या नहीं",
  "device.connect.limitReadings":
    "हर डिवाइस हर रीडिंग साझा नहीं करता। केवल वही माप दिखेंगे जो आपका डिवाइस भेजता है।",
  "device.connect.limitManual":
    "कुछ रक्तचाप मापने वाले यंत्र और ग्लूकोज़ मीटर माप लेने के बाद ही रीडिंग भेजते हैं।",
  "device.connect.limitBackground":
    "लाइफलाइन अपने आप दोबारा नहीं जुड़ सकता, पृष्ठभूमि में माप नहीं ले सकता, और यह पेज बंद होने के बाद किसी तक नहीं पहुँच सकता।",
  "device.connect.technicalTitle": "तकनीकी जानकारी",
  "device.connect.technicalBody":
    "लाइफलाइन ब्राउज़र से ये मानक ब्लूटूथ सेवाएँ माँगता है: हृदय गति (0x180D), पल्स ऑक्सीमीटर (0x1822), रक्तचाप (0x1810) और ग्लूकोज़ (0x1808)। डिवाइस की सूची आपके डिवाइस से बाहर नहीं जाती।",

  "common.skip": "मुख्य सामग्री पर जाएँ",
  "device.connect.invalidReading":
    "रीडिंग समझ नहीं आई। डिवाइस ठीक से लगाएँ और फिर माप लें। आप कनेक्शन हटाकर फिर कोशिश कर सकते हैं।",
  "reading.hr": "हृदय गति",
  "reading.spo2": "खून में ऑक्सीजन",
  "reading.bp": "रक्तचाप",
  "reading.glucose": "खून में शर्करा",
  "network.offline":
    "इंटरनेट उपलब्ध नहीं लगता। सहेजा हुआ पाठ खुल सकता है। ऑनलाइन अनुवाद और खाते में सहेजना उपलब्ध नहीं हैं। कॉल और संदेश के लिए फोन सेवा चाहिए; यहाँ पहुँचने की पुष्टि नहीं होती।",
  "translation.consent":
    "मैं चुना हुआ सार्वजनिक सेटअप वाक्य अनुवाद सेवा को भेजने की सहमति देता/देती हूँ। मैं स्वास्थ्य, स्थान या संपर्क की जानकारी नहीं डालूँगा/डालूँगी।",
  "translation.scope":
    "केवल ये सार्वजनिक सेटअप वाक्य ऑनलाइन अनुवाद किए जा सकते हैं। स्वास्थ्य, आपातकालीन, स्थान और संपर्क का पाठ भेजना बंद है। ऐप की भाषा फ़ाइलें इसके बिना काम करती हैं।",
  "translation.phrase": "सार्वजनिक सेटअप वाक्य",
  "privacy.title": "इस डिवाइस पर आपकी जानकारी",
  "privacy.body":
    "साइन आउट होने पर संपर्क, प्रोफ़ाइल, सीमाएँ और भाषा इसी ब्राउज़र में सहेजी जाती हैं, यदि अनुमति हो। इस ब्राउज़र का उपयोग करने वाला इन्हें पढ़ सकता है। डिवाइस रीडिंग और बातचीत केवल खुले टैब में रहती हैं। संपर्कों को अपने आप कुछ नहीं भेजा जाता। खाता सेट होने पर अलग से सहेजना होता है।",
  "privacy.export": "इस ब्राउज़र की जानकारी डाउनलोड करें",
  "privacy.clear": "इस ब्राउज़र की जानकारी मिटाएँ",
  "privacy.confirm": "इस ब्राउज़र से मिटाने की पुष्टि करें",
  "privacy.deleted":
    "इस ब्राउज़र की जानकारी मिटा दी गई। खाते की जानकारी हो तो खाता पेज से अलग मिटाएँ।",
  ...releaseHi,
  ...contactsHi,
  ...accountHi,
};

export const packs: Record<LocaleCode, Pack> = {
  en: {},
  hi,
};
