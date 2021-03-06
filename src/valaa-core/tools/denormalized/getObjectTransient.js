// @flow
import type { IdData } from "~/valaa-core/ValaaReference";
import type { State } from "~/valaa-core/tools/denormalized/State";
import type { Transient } from "~/valaa-core/tools/denormalized/Transient";
import Resolver from "~/valaa-core/tools/denormalized/Resolver";

import { wrapError } from "~/valaa-tools";

/**
 * Returns a transient which corresponds to given idData and typeName in given state.
 * Like tryObjectTransient but throws if no transient is found.
 * idData :[id :string, ghostPath, coupledField :string]
 * ghostPath :Map<hostPrototypeRawId, [ghostHostId, optional<ghostId>]>
 */
export default function getObjectTransient (stateOrResolver: State, idData: IdData,
    typeName: string, logger: Object = console, objectTable: ?Object, require: boolean = true):
        Transient {
  try {
    const ret = tryObjectTransient(stateOrResolver, idData, typeName, logger, objectTable);
    if (!ret && require) throw new Error(`Object ${String(idData)} resolved to falsy`);
    return ret;
  } catch (error) {
    throw wrapError(error, `During getObjectTransient, with:`,
        "\n\tidData:", idData,
        "\n\ttypeName:", typeName);
  }
}

/**
 * Returns a transient which corresponds to given idData and typeName in given state.
 * If a transient for the idData raw id is not found and the idData has a ghostPath, the path is
 * traversed and most derived materialized transient will be returned. In this case the transient id
 * is overridden to be the requested id and transient[PrototypeOfImmaterialTag] is set to the most
 * inherited materialized prototype transient.
 *
 * Returns undefined if no idData is given. Returns null if no transient was found.
 *
 * @export
 * @param {State} state
 * @param {IdData} idData
 * @param {string} typeName
 * @param {Object} logger
 * @param null objectTable
 * @param {any} Object
 * @returns {Transient}
 */
export function tryObjectTransient (stateOrResolver: State, idData: IdData, typeName: string,
    logger: Object): Transient {
  if (!idData) return undefined;
  const resolver = stateOrResolver.goToTransientOfId
      ? stateOrResolver
      : new Resolver({ state: stateOrResolver, logger });
  return resolver.tryGoToTransientOfId(idData, typeName);
}
