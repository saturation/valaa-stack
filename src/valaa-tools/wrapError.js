import { Iterable } from "immutable";
// import StackTrace from "stacktrace-js";
import beaumpify from "~/valaa-tools/beaumpify";
import { invariantifyObject } from "~/valaa-tools/invariantify";

if (typeof window !== "undefined") window.beaumpify = beaumpify;

export function dumpObject (value) {
  const ret = [];
  if (value && (typeof value === "object")) {
    const denormalized = Iterable.isKeyed(value) ? value
        : Iterable.isKeyed(value._singular) ? value._singular
        : null;
    const name = denormalized && denormalized.get("name");
    if (name) ret.push(`'${name}'`);
    const dumpifiable = value._singular ? value
        : Iterable.isKeyed(value) && value.get("id");
    if (dumpifiable) ret.push(String(dumpifiable));
  }
  ret.push(debugObject(value));
  return ret;
}

/**
 *  Wraps given error in a new error, with given contextDescriptions added.
 *  The contextDescription can be anything that can be given to console.log/error, but as guideline:
 *  throw wrapError(error, `During MyClass(${instanceId}).myFunction(`, param1, `}), with:`,
 *      "\n\tcontextdata1:", contextdata1,
 *      "\n\tcontextdata2:", contextdata2);
 * ${beaumpify(someLargerObject)}`
 *
 * @export
 * @param {any} error
 * @param {any} contextDescription
 * @returns
 */
export default function wrapError (errorIn: Error, ...contextDescriptions) {
  const error = (errorIn instanceof XMLHttpRequest) ? new Error(errorIn) : errorIn;
  if (!(error instanceof Error)) {
    console.error("INVARIANT VIOLATION during wrapError: first argument must be an Error object!",
        "Instead got", error);
    invariantifyObject(error, "wrapError.error", { instanceof: Error });
  }
  const WrappedType = error.constructor;
  const clippedFrameList = _clipFrameListToCurrentContext(error, error.frameListClipDepth || 4);
  const originalMessage = error.originalMessage || error.message;
  const myTraceAndContext = `${clippedFrameList.join("\n")}
${contextDescriptions.map(debugObjectHard).join(" ")}`;
  const allTraceAndContext = `${error.allTraceAndContext || ""}
${myTraceAndContext}`;
  const ret = new WrappedType(`${originalMessage}\n${allTraceAndContext}`,
    error.fileName, error.lineNumber);
  ret.clippedFrameList = clippedFrameList;
  ret.allTraceAndContext = allTraceAndContext;
  ret.originalError = error.originalError || error;
  ret.originalMessage = originalMessage;
  ret.contextDescriptions = contextDescriptions;
  ret.errorContexts = (error.errorContexts || []).concat([ret]);

  // FIXME (thiago) this breaks abstractions
  ret.sourceStackFrames = errorIn.sourceStackFrames;
  ret.customErrorHandler = errorIn.customErrorHandler;
  return ret;
}

function _clipFrameListToCurrentContext (innerError, dummySliceLineCount) {
  if (!innerError.stack) return ["<<< inner error stack empty>>>"];
  const typeHeader = innerError.stack.match(/[^:]*: /);
  const innerTraceList = innerError.stack
      .slice(((typeHeader && typeHeader[0].length) || 0) + innerError.message.length)
      .split("\n")
      .slice(1);
  if (typeof dummySliceLineCount === "undefined") return innerTraceList;
  const outerTraceList = (new Error("dummy")).stack.split("\n").slice(dummySliceLineCount);
  for (let i = Math.max(0, innerTraceList.length - outerTraceList.length)
      ; i < innerTraceList.length; i += 1) {
    let j = 0;
    while (i + j < innerTraceList.length && j < outerTraceList.length
        && innerTraceList[i + j] === outerTraceList[j]) ++j;
    if (i + j === innerTraceList.length) return innerTraceList.slice(0, i);
  }
  return innerTraceList.concat(["<<< possibly missing frames >>>"]);
}

export function executingInJest () {
  return window && window.afterAll;
}

export function inBrowser () {
  // TODO(iridian): Properly differentiate between browser and jest environments.
  return window
      && (!process || (process.env.NODE_ENV !== "production"))
      && !executingInJest();
}

export function getGlobal () {
  return (typeof window !== "undefined") ? window
    : (typeof global !== "undefined") ? global
    : (typeof self !== "undefined") ? self
    : ((() => { throw new Error("Cannot determine global object"); })());
}

export function outputError (error, counter = 0, header = "Exception caught",
    logger = errorLogger) {
  logger.error(`  ${header} (with ${(error.errorContexts || []).length} contexts):\n\n`,
      error.originalMessage || error.message, `\n `);
  if (error.customErrorHandler) {
    error.customErrorHandler(logger);
  }
  for (const context of (error.errorContexts || [])) {
    logger.log((context.clippedFrameList).join("\n"));
    logger.error(...context.contextDescriptions.map(beaumpifyObject));
  }
  logger.log(_clipFrameListToCurrentContext(error).slice(1).join("\n"));
}

export function outputCollapsedError (error, counter = 0, header = "Exception caught",
    logger = errorLogger) {
  const collapsedContexts = [];
  const collapsingLogger = {
    log: (...args) => collapsedContexts[collapsedContexts.length - 1].traces.push(
        ...args[0].split("\n")),
    warn: (...args) => collapsedContexts.push({ context: args, traces: [] }),
    error: (...args) => collapsedContexts.push({ context: args, traces: [] }),
  };
  const ret = outputError(error, counter, header, collapsingLogger);
  delete collapsedContexts[0].context;
  logger.error(`  ${header} (with ${(error.errorContexts || []).length} collapsed contexts):\n`,
      error.originalMessage || error.message, "\n", { collapsedContexts });
  return ret;
}

// async function displayErrorStackFramesWithSourceMaps (error, counter, logger) {
//   const stackFrameListPromises = (error.errorContexts || []).map(
//       wrappedError => StackTrace.fromError(wrappedError).then(
//           onSuccessValue => {
//             // console.log("Resolved stack frame:", onSuccessValue);
//             return onSuccessValue;
//           },
//           onFailureValue => {
//             // console.log("Failed to resolve stack frame:", onFailureValue);
//             throw onFailureValue;
//           }));
//   stackFrameListPromises.push(StackTrace.fromError(error));
//   // console.log("Awaiting", stackFrameListPromises.length, "stack frames:",
//          stackFrameListPromises);
//   const stackFrameLists = await Promise.all(stackFrameListPromises);
//   logger.error(`  Sourcemapped exception stack trace #${counter} (with ${
//       error.errorContexts.length} contexts):\n\n  `,
//       error.originalMessage || error.message, `\n `);
//   displayErrorStackFrameLists(stackFrameLists, error.contextDescriptions, logger);
// }

export function debugObject (head) { return debugObjectNest(head); }
export function debugObjectHard (head) { return debugObjectNest(head, 1, true); }

export function debugObjectNest (head, nest = 1, alwaysStringify = false) {
  if (!head || (!alwaysStringify && inBrowser())) return head;
  if (typeof head === "function") return `[[function.name '${head.name}']]`;
  if (head instanceof Function) return `[[Function.name '${head.name}']]`;
  if (typeof head === "symbol") return `[[${head.toString()}]]`;
  if (typeof head !== "object") return head;
  if (!nest) {
    if (Array.isArray(head)) return `[[Array.length==${head.length}]]`;
    if (Iterable.isIterable(head)) return `[[Iterable.size==${head.size}]]`;
  }
  if (head.toString
      && (head.toString !== Object.prototype.toString)
      && (head.toString !== Array.prototype.toString)) {
    return head.toString(nest);
  }
  if (!nest) {
    return `[[${(head.constructor && head.constructor.name) || "<no constructor>"}.keys.length==${
        Object.keys(head).length}]]`;
  }
  return ((Array.isArray(head)
          && `[${head.map(entry => debugObjectNest(entry, nest, alwaysStringify)).join(", ")}]`)
      || (Iterable.isIterable(head) && debugObjectNest(head.toJS(), nest, alwaysStringify))
      || `{ ${Object.keys(head)
            .map(key => `${typeof key === "symbol" ? key.toString() : key}: ${
                debugObjectNest(head[key], nest - 1, alwaysStringify)}`)
            .join(", ")
          } }`);
}

function beaumpifyObject (value) {
  if (inBrowser() || !value || (typeof value !== "object")) return value;
  return beaumpify(debugObject(value));
}

let errorLogger = typeof window !== "undefined" || !process
    ? console
    : {
      log (...params) { console.log(...params.map(beaumpifyObject)); },
      warn (...params) { console.warn(...params.map(beaumpifyObject)); },
      error (...params) { console.error(...params.map(beaumpifyObject)); },
    };

let stackFrameCounter = 0;

if (typeof process !== "undefined") {
  process.on("unhandledRejection", unhandledRejection);
}

if (typeof window !== "undefined") {
  window.addEventListener("error", event => {
    event.preventDefault();
    unhandledError(event.error);
  });
  window.addEventListener("unhandledrejection", event => {
    event.preventDefault();
    unhandledRejection(event.reason, event.promise);
  });
}

function unhandledError (error) {
  const header = `VALAA ERROR: Unhandled exception`;
  if (error instanceof Error) {
    stackFrameCounter += 1;
    outputError(error, stackFrameCounter, header, errorLogger);
  } else {
    errorLogger.error(header);
    errorLogger.error(`  Irregular error info:`,
        (error && typeof error === "object" && (error.stack || error.message)) || error);
  }
}

function unhandledRejection (reason, promise) {
  const header =
      `VALAA INTERNAL ERROR: Unhandled Rejection: a Promise somewhere is missing then/catch and `
      + `an exception occurred.\n\tUnhandled rejection happens when an async function throws and `
      + `the call site doesn't handle the Promise returned by the function (neither with await nor `
      + `by explicit .then/.catch).
The actual exception caught is `;
  if (reason instanceof Error) {
    stackFrameCounter += 1;
    outputError(reason, stackFrameCounter, header, errorLogger);
  } else {
    errorLogger.error(header);
    errorLogger.error(`  Error info:`, promise,
        (reason && typeof reason === "object" && (reason.stack || reason.message)) || reason);
  }
}

Error.stackTraceLimit = 100000;
