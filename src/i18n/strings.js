// Lightweight i18n: English + Bangla for the app chrome.
// Screens call t('key'); language switches live from Settings.
const D = {
  en: {
    feed: 'Feed', discover: 'Discover', chats: 'Chats', campus: 'Campus', profile: 'Profile',
    myAccount: 'My Account', publicProfile: 'Public Profile',
    settings: 'Settings', education: 'Education', signOut: 'Sign out',
    save: 'Save changes', saved: 'Saved!',
    nightMode: 'Night mode', language: 'Language', theme: 'Theme',
    appearance: 'Appearance', privacy: 'Privacy',
    showActive: 'Show my active status & last seen',
    showActiveHint: 'Turn off to hide when you were last online — you also stop seeing others\u2019 status.',
    blockedAccounts: 'Blocked accounts', unblock: 'Unblock',
    noBlocked: 'You haven\u2019t blocked anyone.',
    activeNow: 'Active now', lastSeen: 'Last seen',
    descAccount: 'Name, username, birthday, contact & more',
    descPublic: 'Your posts, story, saved posts and friends',
    descSettings: 'Night mode, language, theme, privacy',
    descEducation: 'University, college, major, interests',
  },
  bn: {
    feed: 'ফিড', discover: 'খুঁজুন', chats: 'চ্যাট', campus: 'ক্যাম্পাস', profile: 'প্রোফাইল',
    myAccount: 'আমার অ্যাকাউন্ট', publicProfile: 'পাবলিক প্রোফাইল',
    settings: 'সেটিংস', education: 'শিক্ষা', signOut: 'সাইন আউট',
    save: 'সংরক্ষণ করুন', saved: 'সংরক্ষিত!',
    nightMode: 'নাইট মোড', language: 'ভাষা', theme: 'থিম',
    appearance: 'অ্যাপের চেহারা', privacy: 'প্রাইভেসি',
    showActive: 'আমার সক্রিয় অবস্থা ও লাস্ট সিন দেখান',
    showActiveHint: 'বন্ধ করলে আপনি কখন অনলাইনে ছিলেন তা কেউ দেখবে না — আপনিও অন্যদেরটা দেখবেন না।',
    blockedAccounts: 'ব্লক করা অ্যাকাউন্ট', unblock: 'আনব্লক',
    noBlocked: 'আপনি কাউকে ব্লক করেননি।',
    activeNow: 'সক্রিয় এখন', lastSeen: 'শেষ দেখা',
    descAccount: 'নাম, ইউজারনেম, জন্মদিন, যোগাযোগ',
    descPublic: 'আপনার পোস্ট, স্টোরি, সেভ করা ও বন্ধুরা',
    descSettings: 'নাইট মোড, ভাষা, থিম, প্রাইভেসি',
    descEducation: 'বিশ্ববিদ্যালয়, কলেজ, মেজর, আগ্রহ',
  },
};

export let LANG = 'en';
export const setLang = (l) => { LANG = D[l] ? l : 'en'; };
export const t = (k) => (D[LANG] && D[LANG][k]) || D.en[k] || k;
