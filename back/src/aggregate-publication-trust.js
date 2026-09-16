/**
 * Raízes de confiança revisadas fazem parte do artefato, não da configuração
 * operacional. O array permanece vazio até a autoridade humana fornecer e
 * aprovar uma chave Ed25519. Alterá-lo exige novo release e novas receipts.
 */
export const PINNED_AGGREGATE_AUTHORITIES = Object.freeze([]);
