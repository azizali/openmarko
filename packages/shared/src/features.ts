// What an Organization uses: the feature switches app.config.ts declares. A feature works only when:
//   its module is enabled (app.config)  AND  the Plan allows it  AND  the Organization has it switched on
//   AND  what it needs (any one of needsAny) is on.
// Being on is a choice; being connected (an email provider, a model key) is separate, and each page handles
// "not connected yet". Turning a feature off hides its pages; nothing is deleted.
import { appConfig, type FeatureId } from "../../../app.config";

export type { FeatureId };

export type Feature = {
  id: FeatureId;
  label: string;
  description: string;
  /** The module that provides it. A feature of a module that's off is off. */
  module?: string;
  /** On only when at least one of these is on too. */
  needsAny?: FeatureId[];
};

export const features: Feature[] = appConfig.features.map((f) => ({ ...f }) as Feature);
export const featureOf = (id: FeatureId) => features.find((f) => f.id === id)!;
