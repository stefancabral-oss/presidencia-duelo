import { AGGREGATE_PUBLIC_COPY_POLICY, formatAggregateCopy } from "../../shared/aggregate-publication-copy.js";

export const WITHHELD_COPY = AGGREGATE_PUBLIC_COPY_POLICY.withheld.copy;
export const PUBLIC_RANKING_COPY = AGGREGATE_PUBLIC_COPY_POLICY.scopes["global-ranking"].copy;
export const DAILY_DISTRIBUTION_COPY = AGGREGATE_PUBLIC_COPY_POLICY.scopes["daily-distribution"].copy;
export const PREDICTION_REVEAL_COPY = AGGREGATE_PUBLIC_COPY_POLICY.scopes["prediction-reveal"].copy;

export const APP_AGGREGATE_COPY = Object.freeze({
  withheld: WITHHELD_COPY,
  "global-ranking": PUBLIC_RANKING_COPY,
  "daily-distribution": DAILY_DISTRIBUTION_COPY,
  "prediction-reveal": PREDICTION_REVEAL_COPY,
});

export { formatAggregateCopy };
