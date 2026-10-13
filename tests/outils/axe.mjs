// axe réglé sur WCAG 2.0, 2.1 et 2.2, niveaux A et AA : chaque violation en une ligne (« règle : éléments »).
import { AxeBuilder } from '@axe-core/playwright';

export const NORMES = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

export const violationsAxe = async (onglet) => {
  const resultat = await new AxeBuilder({ page: onglet }).withTags(NORMES).analyze();
  return resultat.violations.map((v) => `${v.id} : ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
};
