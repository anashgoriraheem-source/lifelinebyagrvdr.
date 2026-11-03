/**
 * Private safety account surface (`/account`).
 *
 * English and Hindi live side by side; `accountHi` is typed against
 * `accountEn`, so a missing Hindi string is a build error rather than a silent
 * fall back to English mid-page. Error text returned by Supabase or a server
 * function is shown as received and is not translated here.
 */
export const accountEn = {
  "account.title": "Safety account",
  "account.subtitle": "Optional, private medical details and trusted contacts.",

  "account.langHeading": "Language and consent",
  "account.langNote":
    "Changing the language previews it immediately. When you are signed in, it is saved to your account; otherwise it is saved in this browser. Interface translations are independent of machine translation on the Translate page.",
  "account.manageContacts": "Manage automatic contact consent and channels →",

  "account.passwordTitle": "Choose a new password",
  "account.createTitle": "Create account",
  "account.recoverTitle": "Recover account",
  "account.signInTitle": "Sign in",
  "account.email": "Email",
  "account.password": "Password",
  "account.wait": "Please wait…",
  "account.updatePassword": "Update password",
  "account.createAccount": "Create account",
  "account.sendRecovery": "Send recovery email",
  "account.signInEmail": "Sign in with email",
  "account.signInWith": "Sign in with {provider}",
  "account.haveAccount": "Already have an account?",
  "account.noAccount": "Create an account",
  "account.backToSignIn": "Back to sign in",
  "account.forgotPassword": "Forgot password?",
  "account.phoneNote":
    "Phone sign-in is not available until an SMS provider is configured. Emergency calls remain available without signing in.",
  "account.passwordUpdated": "Password updated.",
  "account.recoverySent": "If this email has an account, a recovery link will arrive shortly.",
  "account.checkEmail": "Check your email and confirm your account before signing in.",

  "account.signOut": "Sign out",
  "account.loadingPrivate": "Loading private data…",
  "account.loadError": "Your saved data could not be loaded.",

  "account.importHeading": "Import this device’s contacts",
  "account.importBody":
    "Replaces account contacts only after confirmation. Your previous device-local contacts are not uploaded automatically.",
  "account.importButton": "Import saved device contacts",
  "account.importNone": "No saved device contacts found.",
  "account.importConfirm": "Replace your account contacts with this device’s saved contacts?",
  "account.importDone": "Device contacts imported to your private account.",

  "account.profileHeading": "Personal safety profile",
  "account.profileNoteAccount":
    "Only you can access this profile in your private account. Including it in an emergency message requires a separate choice.",
  "account.profileNoteLocal":
    "Saved in this browser only — nothing is backed up or synced until you sign in. Including it in an emergency message requires a separate choice.",
  "account.fieldName": "Name",
  "account.fieldAge": "Age",
  "account.fieldBlood": "Blood type",
  "account.bloodNotProvided": "Not provided",
  "account.fieldConditions": "Conditions",
  "account.fieldAllergies": "Allergies",
  "account.fieldMedications": "Medications",
  "account.separateWithCommas": "Separate entries with commas.",
  "account.savePrivate": "Save private profile",
  "account.saveLocal": "Save to this browser",
  "account.profileSavedAccount": "Private profile saved to your account.",
  "account.profileSavedLocal":
    "Profile saved in this browser only. Sign in to keep it private across devices.",

  "account.privacyHeading": "Privacy centre",
  "account.privacyBody":
    "Signed-out contacts and profile stay in this browser. Signed-in profiles and explicitly saved contacts stay in your private cloud account. Location is held in memory, not uploaded. Your timeline lasts for this session. Shared texts leave Lifeline and follow the recipient’s privacy practices.",
  "account.exportAccount": "Export my account data",
  "account.exportLocal": "Export current data",
  "account.exportDoneAccount": "Your account data was exported.",
  "account.exportDoneLocal": "Your data on this device was exported.",
  "account.deleteData": "Delete safety data",
  "account.deleteDataConfirm":
    "Delete your contacts, profile and saved incidents? This cannot be undone.",
  "account.dataDeleted": "Safety data deleted.",
  "account.deleteAccount": "Delete account",
  "account.deleteAccountConfirm": "Permanently delete your account and all safety data?",
  "account.accountDeleted": "Account deleted.",
} as const;

export type AccountKey = keyof typeof accountEn;

export const accountHi: Record<AccountKey, string> = {
  "account.title": "सुरक्षा खाता",
  "account.subtitle": "वैकल्पिक, निजी चिकित्सीय जानकारी और भरोसेमंद संपर्क।",

  "account.langHeading": "भाषा और सहमति",
  "account.langNote":
    "भाषा बदलते ही उसका पूर्वावलोकन दिखता है। साइन इन होने पर यह आपके खाते में सहेजी जाती है, अन्यथा इस ब्राउज़र में। इंटरफ़ेस अनुवाद, अनुवाद पृष्ठ के मशीन अनुवाद से स्वतंत्र हैं।",
  "account.manageContacts": "स्वतः संपर्क सहमति और चैनल प्रबंधित करें →",

  "account.passwordTitle": "नया पासवर्ड चुनें",
  "account.createTitle": "खाता बनाएँ",
  "account.recoverTitle": "खाता पुनर्प्राप्त करें",
  "account.signInTitle": "साइन इन करें",
  "account.email": "ईमेल",
  "account.password": "पासवर्ड",
  "account.wait": "कृपया प्रतीक्षा करें…",
  "account.updatePassword": "पासवर्ड बदलें",
  "account.createAccount": "खाता बनाएँ",
  "account.sendRecovery": "रिकवरी ईमेल भेजें",
  "account.signInEmail": "ईमेल से साइन इन करें",
  "account.signInWith": "{provider} से साइन इन करें",
  "account.haveAccount": "पहले से खाता है?",
  "account.noAccount": "खाता बनाएँ",
  "account.backToSignIn": "साइन इन पर लौटें",
  "account.forgotPassword": "पासवर्ड भूल गए?",
  "account.phoneNote":
    "SMS प्रदाता कॉन्फ़िगर होने तक फ़ोन से साइन इन उपलब्ध नहीं है। साइन इन के बिना भी आपातकालीन कॉल उपलब्ध रहते हैं।",
  "account.passwordUpdated": "पासवर्ड बदल गया।",
  "account.recoverySent": "अगर इस ईमेल पर खाता है, तो रिकवरी लिंक शीघ्र आएगा।",
  "account.checkEmail": "साइन इन करने से पहले अपना ईमेल जाँचें और खाते की पुष्टि करें।",

  "account.signOut": "साइन आउट",
  "account.loadingPrivate": "निजी डेटा लोड हो रहा है…",
  "account.loadError": "आपका सहेजा हुआ डेटा लोड नहीं हो सका।",

  "account.importHeading": "इस डिवाइस के संपर्क आयात करें",
  "account.importBody":
    "पुष्टि के बाद ही खाते के संपर्क बदले जाते हैं। आपके पिछले डिवाइस-स्थानीय संपर्क अपने आप अपलोड नहीं होते।",
  "account.importButton": "सहेजे गए डिवाइस संपर्क आयात करें",
  "account.importNone": "कोई सहेजा गया डिवाइस संपर्क नहीं मिला।",
  "account.importConfirm": "अपने खाते के संपर्कों को इस डिवाइस के सहेजे संपर्कों से बदलें?",
  "account.importDone": "डिवाइस संपर्क आपके निजी खाते में आयात हो गए।",

  "account.profileHeading": "व्यक्तिगत सुरक्षा प्रोफ़ाइल",
  "account.profileNoteAccount":
    "इस प्रोफ़ाइल तक केवल आप ही अपने निजी खाते में पहुँच सकते हैं। आपातकालीन संदेश में इसे शामिल करने के लिए अलग निर्णय चाहिए।",
  "account.profileNoteLocal":
    "केवल इस ब्राउज़र में सहेजा गया — साइन इन करने तक कुछ भी बैकअप या सिंक नहीं होता। आपातकालीन संदेश में इसे शामिल करने के लिए अलग निर्णय चाहिए।",
  "account.fieldName": "नाम",
  "account.fieldAge": "उम्र",
  "account.fieldBlood": "रक्त समूह",
  "account.bloodNotProvided": "नहीं दिया गया",
  "account.fieldConditions": "स्थितियाँ",
  "account.fieldAllergies": "एलर्जी",
  "account.fieldMedications": "दवाइयाँ",
  "account.separateWithCommas": "प्रविष्टियाँ कॉमा से अलग करें।",
  "account.savePrivate": "निजी प्रोफ़ाइल सहेजें",
  "account.saveLocal": "इस ब्राउज़र में सहेजें",
  "account.profileSavedAccount": "निजी प्रोफ़ाइल आपके खाते में सहेजी गई।",
  "account.profileSavedLocal":
    "प्रोफ़ाइल केवल इस ब्राउज़र में सहेजी गई। सभी डिवाइस पर निजी रूप से रखने के लिए साइन इन करें।",

  "account.privacyHeading": "गोपनीयता केंद्र",
  "account.privacyBody":
    "साइन-आउट संपर्क और प्रोफ़ाइल इस ब्राउज़र में रहते हैं। साइन-इन प्रोफ़ाइल और स्पष्ट रूप से सहेजे गए संपर्क आपके निजी क्लाउड खाते में रहते हैं। लोकेशन मेमोरी में रहती है, अपलोड नहीं होती। आपकी टाइमलाइन इस सत्र तक रहती है। साझा किए गए संदेश आपदा सेतु से बाहर जाते हैं और प्राप्तकर्ता की गोपनीयता प्रथाओं का पालन करते हैं।",
  "account.exportAccount": "मेरा खाता डेटा निर्यात करें",
  "account.exportLocal": "मौजूदा डेटा निर्यात करें",
  "account.exportDoneAccount": "आपका खाता डेटा निर्यात हो गया।",
  "account.exportDoneLocal": "इस डिवाइस पर आपका डेटा निर्यात हो गया।",
  "account.deleteData": "सुरक्षा डेटा हटाएँ",
  "account.deleteDataConfirm":
    "अपने संपर्क, प्रोफ़ाइल और सहेजी गई घटनाएँ हटाएँ? इसे वापस नहीं लाया जा सकता।",
  "account.dataDeleted": "सुरक्षा डेटा हटा दिया गया।",
  "account.deleteAccount": "खाता हटाएँ",
  "account.deleteAccountConfirm": "अपना खाता और सारा सुरक्षा डेटा स्थायी रूप से हटाएँ?",
  "account.accountDeleted": "खाता हटा दिया गया।",
};
