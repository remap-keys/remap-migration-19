import * as fs from 'fs';
import * as path from 'path';
import * as hjson from 'hjson';
import { IKeycodeInfo, KeyInfo, keyInfoList } from './KeycodeInfoList';

type QmkKeycodeRange = {
  define: string;
};

type QmkKeycodeRanges = {
  [range: string]: QmkKeycodeRange;
};

type QmkKeycodeAlias = string[];

type QmkKeycode = {
  key: string;
  group?: string;
  aliases?: QmkKeycodeAlias;
  label?: string;
};

type QmkKeycodes = {
  [keycode: string]: QmkKeycode;
};

type QmkKeycodesJson = {
  ranges?: QmkKeycodeRanges;
  keycodes?: QmkKeycodes;
};

type QmkKeycodesPerVersion = {
  [version: string]: QmkKeycodesJson;
};

type QmkKeycodesPerCategory = {
  [category: string]: QmkKeycodesPerVersion;
};

const QMK_KEYCODES_JSON_PATH = '../../qmk_firmware/data/constants/keycodes';

const loadQmkKeycodesJsonFiles = (): QmkKeycodesPerCategory => {
  const qmkKeycodesPerCategory: QmkKeycodesPerCategory = {};
  console.log('Loading keycode JSON file from QMK Firmware...');
  const filenames = fs.readdirSync(QMK_KEYCODES_JSON_PATH);
  filenames.sort();
  filenames
    .filter((filename) => filename.endsWith('.hjson'))
    .forEach((filename) => {
      const version = filename.match(
        /^keycodes_([0-9]+\.[0-9]+\.[0-9]+)([_a-z]+)?\.hjson$/
      )?.[1]!;
      let category = filename.match(
        /^keycodes_([0-9]+\.[0-9]+\.[0-9]+)([_a-z]+)\.hjson$/
      )?.[2];
      category = category ? category.replace(/^_/, '') : '_';
      const filepath = path.join(QMK_KEYCODES_JSON_PATH, filename);
      console.log(`Loading ${filepath}...`);
      const body = fs.readFileSync(filepath, 'utf8');
      const json = hjson.parse(body) as QmkKeycodesJson;
      let categoryMap = qmkKeycodesPerCategory[category];
      if (!categoryMap) {
        categoryMap = {};
        qmkKeycodesPerCategory[category] = categoryMap;
      }
      qmkKeycodesPerCategory[category][version] = json;
    });
  console.log('Loading keycode JSON file from QMK Firmware... Done.');
  return qmkKeycodesPerCategory;
};

const processKeycodes = (
  qmkKeycodesPerCategory: QmkKeycodesPerCategory
): QmkKeycodes => {
  console.log('Processing keycodes...');
  const categories = Object.keys(qmkKeycodesPerCategory);
  categories.sort();
  const allQmkKeycodes: QmkKeycodes = {};
  for (const category of categories) {
    const versions = Object.keys(qmkKeycodesPerCategory[category]);
    versions.sort();
    const qmkKeycodesList: QmkKeycodes[] = [];
    for (const version of versions) {
      console.log(`Category: ${category} Version: ${version}`);
      const keycodes = qmkKeycodesPerCategory[category][version].keycodes;
      if (keycodes === undefined) {
        console.log('No keycodes. Skip.');
      } else {
        qmkKeycodesList.push(keycodes);
      }
    }
    let qmkKeycodesForOneCategory: QmkKeycodes = {};
    for (const qmkKeycodes of qmkKeycodesList) {
      const keys = Object.keys(qmkKeycodes);
      if (keys.includes('!reset!')) {
        console.log(`Found !reset!. Remove all keycodes for ${category}.`);
        qmkKeycodesForOneCategory = {};
        keys.splice(keys.indexOf('!reset!'), 1);
      }
      for (const key of keys) {
        qmkKeycodesForOneCategory[key] = qmkKeycodes[key];
      }
    }
    for (const key of Object.keys(qmkKeycodesForOneCategory)) {
      allQmkKeycodes[key] = qmkKeycodesForOneCategory[key];
    }
  }
  console.log('Processing keycodes... Done.');
  return allQmkKeycodes;
};

const main = async (): Promise<void> => {
  const qmkKeycodesPerCategory = loadQmkKeycodesJsonFiles();
  const qmkKeycodes = processKeycodes(qmkKeycodesPerCategory);
  const newKeyInfoList: KeyInfo[] = [];
  for (const codeHex of Object.keys(qmkKeycodes).sort()) {
    const qmkKeycode = qmkKeycodes[codeHex];
    const code = parseInt(codeHex, 16);
    const keyInfo = keyInfoList.find(
      (keyInfo) => keyInfo.keycodeInfo.code === code
    );
    if (keyInfo !== undefined) {
      if (keyInfo.keycodeInfo.name.long !== qmkKeycode.key) {
        console.log(
          `Keycode name mismatch: ${keyInfo.keycodeInfo.name.long} vs ${qmkKeycode.key}`
        );
      }
    }
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
