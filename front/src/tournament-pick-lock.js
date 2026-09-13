export function createTournamentPickLock({ schedule = setTimeout, delay = 320 } = {}) {
  let locked = false;

  function setDisabled(cards, disabled) {
    for (const card of cards) card.disabled = disabled;
  }

  return {
    get locked() {
      return locked;
    },

    run({ cards, commit, feedback, render }) {
      if (locked) return false;
      locked = true;
      setDisabled(cards, true);
      try {
        if (!commit()) {
          locked = false;
          setDisabled(cards, false);
          return false;
        }
        feedback?.();
        schedule(() => {
          try {
            render();
          } finally {
            locked = false;
            setDisabled(cards, false);
          }
        }, delay);
        return true;
      } catch (error) {
        locked = false;
        setDisabled(cards, false);
        throw error;
      }
    },

    reset(cards = []) {
      locked = false;
      setDisabled(cards, false);
    },
  };
}
