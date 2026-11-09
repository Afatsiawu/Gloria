/**
 * Optional imagery for the landing visuals. Every slot is null by default so
 * the Home page ships with no photos; set a slot to a URL to swap that visual
 * for an image. Files belong in client/public/images/landing/ (square for
 * circles, 4:3 for panels, WebP, 60 KB target). Only use images the project
 * owns or is licensed to use.
 */
const landingImages = {
  hero: null, // 1:1, 800×800
  categories: null, // 1:1, 800×800
  howItWorksFind: null, // 4:3, 800×600
  howItWorksOrder: null, // 4:3, 800×600
  howItWorksReceive: null, // 4:3, 800×600
  pharmacies: null, // 16:9, 1200×675
  prescription: null, // 1:1, 800×800
  tracking: null, // 1:1, 800×800
};

export default landingImages;
