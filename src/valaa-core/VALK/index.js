// @flow

import Kuery from "./Kuery";
import Valker, { run, VALKOptions } from "./Valker";

/**
 * VALK = VAlaa Language for Kuerying.
 * Collection of top-level chainable kuery operations.
 * Default export is an empty kuery root object. It's the starting point for building kueries:
 * `const toOwner = VALK.toField("owner");`.
 * Note the lack of function call parentheses around VALK. This works because VALK kuery objects are
 * immutable. Each kuery member convenience operation returns a new kuery object which represents
 * the new operation added to the previous kuery object. The actual JSON representation of the kuery
 * or VAKON (VAlaa Kuery Object Notation) can be extracted from such a Kuery with toVAKON.
 */
export default from "./VALK";

export {
  Kuery,
  Valker,
  run,
  VALKOptions,
};
export {
  default as builtinSteppers,
  BuiltinStep,
  isValaaFunction,
  toVAKON,
  denoteValaaBuiltin,
  denoteValaaBuiltinWithSignature,
  denoteDeprecatedValaaBuiltin,
  denoteValaaKueryFunction,
} from "./builtinSteppers";
export {
  dumpObject,
  dumpScope,
  dumpKuery,
} from "./Kuery";
export {
  isPackedField,
  tryPackedField,
  packedSingular,
  packedSequence,
} from "./packedField";
export {
  SourceInfoTag,
} from "./StackTrace";
export {
  kueryHash
} from "./kueryHash";
