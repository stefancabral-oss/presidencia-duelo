const approvedBasicArt = {
  1: "/chromas/approved/001_luiz-inacio-lula-da-silva.jpg",
  2: "/chromas/approved/002_flavio-bolsonaro.jpg",
  3: "/chromas/approved/003_renan-santos.jpg",
  4: "/chromas/approved/004_ronaldo-caiado.jpg",
  5: "/chromas/approved/005_augusto-cury.jpg",
  6: "/chromas/approved/006_romeu-zema.jpg",
  7: "/chromas/approved/007_pablo-marcal.jpg",
  11: "/chromas/approved/011_tarcisio-de-freitas.jpg",
  12: "/chromas/approved/012_fernando-haddad.jpg",
  28: "/chromas/approved/028_michelle-bolsonaro.jpg",
  31: "/chromas/approved/031_gleisi-hoffmann.jpg",
  33: "/chromas/approved/033_marina-silva.jpg",
  34: "/chromas/approved/034_simone-tebet.jpg",
  35: "/chromas/approved/035_rui-costa.jpg",
  36: "/chromas/approved/036_hugo-motta.jpg",
  37: "/chromas/approved/037_davi-alcolumbre.jpg",
  39: "/chromas/approved/039_nikolas-ferreira.jpg",
  42: "/chromas/approved/042_bia-kicis.jpg",
  46: "/chromas/approved/046_lindbergh-farias.jpg",
  48: "/chromas/approved/048_guilherme-boulos.jpg",
  51: "/chromas/approved/051_anielle-franco.jpg",
  62: "/chromas/approved/062_flavio-dino.jpg",
  63: "/chromas/approved/063_jair-bolsonaro.jpg",
  64: "/chromas/approved/064_eduardo-bolsonaro.jpg",
  65: "/chromas/approved/065_carlos-bolsonaro.jpg",
  72: "/chromas/approved/072_rodrigo-pacheco.jpg",
  73: "/chromas/approved/073_rogerio-marinho.jpg",
  79: "/chromas/approved/079_kim-kataguiri.jpg",
  80: "/chromas/approved/080_andre-janones.jpg",
  83: "/chromas/approved/083_carla-zambelli.jpg",
  84: "/chromas/approved/084_tabata-amaral.jpg",
  85: "/chromas/approved/085_glauber-braga.jpg",
  86: "/chromas/approved/086_sergio-moro.jpg",
  95: "/chromas/approved/095_deltan-dallagnol.jpg",
  98: "/chromas/approved/098_ricardo-nunes.jpg",
};

const uploadedPortraitSlots = [
  28, 47, 53, 59, 78, 90,
  101, 102, 103, 104, 105, 106, 107, 108,
  109, 110, 111, 112, 121, 125,
];

export const CURATED_PORTRAITS = Object.freeze({
  ...approvedBasicArt,
  ...Object.fromEntries(uploadedPortraitSlots.map((personId) => [
    personId,
    `/portraits/${String(personId).padStart(3, "0")}.jpg`,
  ])),
});

export function curatedPortraitPath(personId) {
  return CURATED_PORTRAITS[Number(personId)] || "";
}

export function hasCuratedPortrait(personId) {
  return Boolean(curatedPortraitPath(personId));
}
