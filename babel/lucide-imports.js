/**
 * Metro does not tree-shake, so `import { Check } from 'lucide-react-native'`
 * would bundle all ~1,800 icons. This rewrites each named icon import to its
 * own module (`lucide-react-native/icons/check`). Type imports and non-icon
 * exports (createLucideIcon, LucideIcon) stay on the package entry.
 */
const fs = require('fs');
const path = require('path');

const PKG = 'lucide-react-native';

function loadIconFiles() {
  // The package's "exports" hide package.json, so resolve the main entry and
  // read its ESM twin, which lists every icon name and alias:
  //   export { default as Ellipsis, default as MoreHorizontal, … } from './icons/ellipsis.mjs';
  const main = require.resolve(PKG); // …/dist/cjs/lucide-react-native.js
  const entry = path.join(main, '../../esm/lucide-react-native.mjs');
  const files = new Map();
  const line = /export \{([^}]*)\} from '\.\/icons\/([\w-]+)\.mjs';/g;
  for (const [, names, file] of fs.readFileSync(entry, 'utf8').matchAll(line)) {
    for (const [, name] of names.matchAll(/default as (\w+)/g)) {
      files.set(name, file);
    }
  }
  return files;
}

module.exports = function lucideImports({ types: t }) {
  const files = loadIconFiles();
  const fileFor = name => files.get(name);

  return {
    name: 'lucide-imports',
    visitor: {
      ImportDeclaration(p) {
        if (p.node.source.value !== PKG || p.node.importKind === 'type') {
          return;
        }
        const keep = [];
        const icons = [];
        for (const s of p.node.specifiers) {
          const file =
            t.isImportSpecifier(s) && s.importKind !== 'type'
              ? fileFor(s.imported.name ?? s.imported.value)
              : undefined;
          if (file) {
            icons.push(
              t.importDeclaration(
                [t.importDefaultSpecifier(t.identifier(s.local.name))],
                t.stringLiteral(`${PKG}/icons/${file}`),
              ),
            );
          } else {
            keep.push(s);
          }
        }
        if (!icons.length) {
          return;
        }
        if (keep.length) {
          p.node.specifiers = keep;
          p.insertAfter(icons);
        } else {
          p.replaceWithMultiple(icons);
        }
      },
    },
  };
};
