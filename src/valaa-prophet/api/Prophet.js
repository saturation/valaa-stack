// @flow

import type Command from "~/valaa-core/command";
import type { PartitionURI } from "~/valaa-core/tools/PartitionURI";
import { VRef } from "~/valaa-core/ValaaReference";

import Follower from "~/valaa-prophet/api/Follower";
import type Prophecy from "~/valaa-prophet/api/Prophecy";
import type PartitionConnection from "~/valaa-prophet/api/PartitionConnection";

import { Logger, LogEventGenerator } from "~/valaa-tools";

export type ClaimResult = {
  prophecy: Prophecy;
  getFinalEvent: () => Promise<Command>;
}

export type EventData = {
  type: "CREATED" | "MODIFIED" | "FIELDS_SET" | "ADDED_TO" | "REMOVED_FROM" | "REPLACED_WITHIN"
      | "SPLICED" | "TRANSACTED" | "FROZEN"
}

export type EventCallback = ((event: EventData) => void);

export type MediaInfo = {
  blobId: string,
  name: string,
  sourceURL: string,
  type: string,
  subtype: string,
};

export type RetrieveMediaContent = (mediaId: VRef, mediaInfo: MediaInfo) => Promise<any>;

export type NarrateOptions = {
  eventLog?: Object[],
  retrieveMediaContent?: RetrieveMediaContent,
  callback?: EventCallback,
  firstEventId?: number,
  lastEventId?: number,
  noSnapshots?: boolean,
};

/* eslint-disable no-unused-vars */

/**
 * Interface for sending commands to upstream.
 */
export default class Prophet extends LogEventGenerator {
  _upstream: Prophet;
  _followers: Follower;

  constructor ({ name, logger, upstream }: { name: any, logger: Logger, upstream: any }) {
    super({ name, logger });
    this._upstream = upstream;
    this._followers = new Map();
  }

  addFollower (follower: Follower): Follower {
    const discourse = this._createDiscourse(follower);
    this._followers.set(follower, discourse);
    return discourse;
  }

  _createDiscourse (follower: Follower) {
    return follower;
  }

  /**
   * claim - Sends a command upstream or rejects it immediately.
   *
   * @param  {type} command                             description
   * @returns {ClaimResult}                             description
   */
  claim (command: Command, options: { timed?: Object } = {}): ClaimResult {
    return this._upstream.claim(command, options);
  }

  _confirmTruthToAllFollowers (authorizedEvent: Object, purgedCommands?: Array<Object>) {
    (this._followers || []).forEach(discourse => {
      try {
        discourse.confirmTruth(authorizedEvent, purgedCommands);
      } catch (error) {
        this.outputErrorEvent(this.wrapErrorEvent(error,
            "_confirmTruthToAllFollowers",
            "\n\tauthorizedEvent:", authorizedEvent,
            "\n\tpurgedCommands:", purgedCommands,
            "\n\ttarget discourse:", discourse,
        ));
      }
    });
  }

  _repeatClaimToAllFollowers (command: Object) {
    (this._followers || []).forEach(discourse => {
      try {
        discourse.repeatClaim(command);
      } catch (error) {
        this.outputErrorEvent(this.wrapErrorEvent(error,
            "_repeatClaimToAllFollowers",
            "\n\trepeated command:", command,
            "\n\ttarget discourse:", discourse,
        ));
      }
    });
    return command;
  }

  /**
   * Returns a connection to partition identified by given partitionURI.
   *
   * The returned connection might be shared between other users and implements internal reference
   * counting; it is acquired once as part of this call. The connection must be manually released
   * with releaseConnection or otherwise the connection resources will be left open.
   *
   * The connection is considered acquired and the promise is resolved after a
   * "optimistic full narration" is complete. This is defined to be first option which
   * results in non-zero events and/or commands:
   * 1. all events and commands of the optional explicit initialNarrateOptions.eventLog option and
   *    the latest previously seen full narration of this partition in the Scribe (deduplicated)
   * 2. all events in the most recent authorized snapshot known by the remote authority connection
   * 3. all events in the remote authorize event log itself
   *
   * Irrespective of where the optimistic full narration is sourced, an authorized full narration is
   * initiated against the remote authority.
   *
   * @param {PartitionURI} partitionURI
   * @returns {PartitionConnection}
   *
   * @memberof Prophet
   */
  acquirePartitionConnection (partitionURI: PartitionURI,
      options: NarrateOptions = {}): PartitionConnection {
    return this._upstream.acquirePartitionConnection(partitionURI, options);
  }

  /**
   * Returns the blob content for given blobId as an ArrayBuffer if it is locally available,
   * undefined otherwise.
   *
   * @param {string} blobId
   * @returns
   *
   * @memberof Prophet
   */
  tryGetCachedBlobContent (blobId: string): ArrayBuffer {
    return this._upstream.tryGetCachedBlobContent(blobId);
  }

  /**
   * Returns a map of actition partition connections by the connection id.
   */
  getFullPartitionConnections () : Map<string, PartitionConnection> {
    return this._upstream.getFullPartitionConnections();
  }
}
