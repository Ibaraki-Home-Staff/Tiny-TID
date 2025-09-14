// Mapping for labels like "うX快○".
// Define only the token between "う" and the trailing circle (○/◯/〇)
// and the normalized display type. Nickname "うれしート" is added automatically.
// Example: { '直快': '直通快速', '区快': '区間快速' }

export const U_TOKEN_TYPE_MAP = {
  '直快': '直通快速',
  '区快': '区間快速',
  'み快': 'みやこ路快速',
  // Add more pairs here as needed
};

