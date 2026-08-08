/**
 * Shared Playwright device matrix for DAG Tails.
 * Landscape only — portrait is blocked by #rotate-lock on phones.
 *
 * Categories:
 * - PHONES / TABLETS — popular handhelds
 * - FOLDS — new fold/flip form factors (Samsung Z Flip/Fold + iPhone Air;
 *   Playwright has no Apple “flip” preset yet)
 */
const PHONES = [
  { name: "phone-galaxy-a55", device: "Galaxy A55 landscape", label: "Galaxy A55 (Android mid)" },
  { name: "phone-pixel-8", device: "Pixel 8 landscape", label: "Pixel 8" },
  { name: "phone-pixel-8-pro", device: "Pixel 8 Pro landscape", label: "Pixel 8 Pro" },
  { name: "phone-galaxy-s24", device: "Galaxy S24 landscape", label: "Galaxy S24" },
  { name: "phone-iphone-se", device: "iPhone SE (3rd gen) landscape", label: "iPhone SE (short)" },
  { name: "phone-iphone-15", device: "iPhone 15 landscape", label: "iPhone 15" },
  { name: "phone-iphone-15-pro", device: "iPhone 15 Pro landscape", label: "iPhone 15 Pro" },
  { name: "phone-iphone-15-pro-max", device: "iPhone 15 Pro Max landscape", label: "iPhone 15 Pro Max" },
  { name: "phone-iphone-13-mini", device: "iPhone 13 Mini landscape", label: "iPhone 13 Mini" },
  { name: "phone-pixel-9-pro-xl", device: "Pixel 9 Pro XL landscape", label: "Pixel 9 Pro XL" },
];

const TABLETS = [
  { name: "tablet-ipad-11", device: "iPad (gen 11) landscape", label: "iPad (gen 11)" },
  { name: "tablet-ipad-mini", device: "iPad Mini landscape", label: "iPad Mini" },
  { name: "tablet-ipad-pro-11", device: "iPad Pro 11 landscape", label: "iPad Pro 11" },
  { name: "tablet-galaxy-tab-s9", device: "Galaxy Tab S9 landscape", label: "Galaxy Tab S9" },
];

/** Foldables / flip / new Apple slab form — stress short & wide aspect ratios. */
const FOLDS = [
  { name: "fold-galaxy-z-flip-7", device: "Galaxy Z Flip 7 landscape", label: "Galaxy Z Flip 7 (unfolded)" },
  { name: "fold-galaxy-z-flip-7-cover", device: "Galaxy Z Flip 7 Cover landscape", label: "Galaxy Z Flip 7 (cover)" },
  { name: "fold-galaxy-z-fold-7", device: "Galaxy Z Fold 7 landscape", label: "Galaxy Z Fold 7 (unfolded)" },
  { name: "fold-galaxy-z-fold-7-cover", device: "Galaxy Z Fold 7 Cover landscape", label: "Galaxy Z Fold 7 (cover)" },
  // Apple has no Flip preset in Playwright; Air is the new ultra-thin form factor.
  { name: "fold-iphone-air", device: "iPhone Air landscape", label: "iPhone Air (new Apple form)" },
];

const ALL_HANDHELDS = [...PHONES, ...TABLETS, ...FOLDS];

/** Project names used by `npm run test:qa` / device-qa agent. */
const QA_PROJECT_NAMES = ALL_HANDHELDS.map((d) => d.name);

/**
 * @param {Record<string, object>} entry
 * @param {import('@playwright/test').Devices} devices
 */
function toProject(entry, devices) {
  const preset = devices[entry.device];
  if (!preset) {
    throw new Error(`Playwright device preset missing: ${entry.device}`);
  }
  return {
    name: entry.name,
    use: {
      ...preset,
      browserName: "chromium",
    },
  };
}

/**
 * @param {import('@playwright/test').Devices} devices
 */
function handheldProjects(devices) {
  return ALL_HANDHELDS.map((entry) => toProject(entry, devices));
}

module.exports = {
  PHONES,
  TABLETS,
  FOLDS,
  ALL_HANDHELDS,
  QA_PROJECT_NAMES,
  handheldProjects,
};
