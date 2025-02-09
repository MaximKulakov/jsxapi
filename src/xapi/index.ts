import { EventEmitter } from 'events';

import log from '../log';
import normalizePath from './normalizePath';
import * as rpc from './rpc';

import { Backend } from '../backend';
import { Config, Event, Status } from './components';
import Feedback from './feedback';
import createXapiProxy from './proxy';
import { Path, XapiError, XapiOptions, XapiResponse } from './types';

interface Requests {
  [idx: string]: {
    resolve(result: any): void;
    reject(result: XapiError): void;
  };
}

export declare interface XAPI {
  on(event: 'error', listener: (error: Error) => void): this;
  on(event: 'ready', listener: (xapi: XAPI) => void): this;
  on(event: string, listener: () => {}): this;
}

/**
 * User-facing API towards the XAPI. Requires a backend for communicating
 * with an XAPI instance. It should be possible to write backends for all kinds
 * of transports (TSH over SSH, Websockets, HTTP, plain sockets, etc.)
 *
 * @example <caption>Initialization</caption>
 * const xapi = new XAPI(backend);
 *
 * @example <caption>Invoke command</caption>
 * xapi
 *   .command('Dial', { Number: 'johndoe@example.com' })
 *   .then(onSuccess, onFailure);
 *
 * // Alternate notation
 * xapi
 *   .Command.Dial({ Number: 'johndoe@example.com' })
 *   .then(onSuccess, onFailure);
 *
 * @example <caption>Fetch a configuration</caption>
 * xapi
 *   .config.get('Audio DefaultVolume')
 *   .then((volume) => console.log(`default volume is: ${volume}`));
 *
 * // Alternate notation
 * xapi.Audio.DefaultVolume
 *   .get()
 *   .then((volume) => console.log(`default volume is: ${volume}`));
 *
 * @example <caption>Set a configuration</caption>
 * xapi.config.set('Audio DefaultVolume', 100);
 *
 * // Alternate notation
 * xapi.Audio.DefaultVolume.set(100);
 *
 * @example <caption>Fetch a status</caption>
 * xapi
 *   .status.get('Audio Volume')
 *   .then((volume) => { console.log(`volume is: ${volume}`); });
 *
 * // Alternate notation
 * xapi.Status.Audio.Volume
 *   .get()
 *   .then((volume) => { console.log(`volume is: ${volume}`); });
 *
 * @example <caption>Listen to an event</caption>
 * xapi.event.on('Message Send Text', (text) => {
 *   console.log(`Received message text: ${text}`);
 * });
 *
 * // Alternate notation
 * xapi.Event.Message.Send.Text.on((text) => {
 *   console.log(`Received message text: ${text}`);
 * });
 */
export class XAPI extends EventEmitter {
  public feedback: Feedback;
  public config: Config;
  public status: Status;
  public event: Event;

  public Command: any;
  public Config: any;
  public Status: any;
  public Event: any;

  /**
   * @param {Backend} backend - Backend connected to an XAPI instance.
   * @param {object} options - XAPI object options.
   * @param {function} options.feedbackInterceptor - Feedback interceptor.
   * @param {function} options.seal - Seal the object from further changes.
   */

  private requestId = 1;
  private requests: Requests = {};

  constructor(
    private readonly backend: Backend,
    options: XapiOptions = { seal: true }) {
    super();

    /**
     * Interface to XAPI feedback registration.
     * @type {Feedback}
     */
    this.feedback = new Feedback(this, options.feedbackInterceptor);

    /**
     * Interface to XAPI configurations.
     * @type {Config}
     */
    this.config = new Config(this);

    /**
     * Interface to XAPI events.
     * @type {Event}
     */
    this.event = new Event(this);

    /**
     * Interface to XAPI statuses.
     * @type {Status}
     */
    this.status = new Status(this);

    /**
     * Proxy for XAPI Command.
     */
    this.Command = createXapiProxy(this, this.command);

    /**
     * Proxy for XAPI Configuration.
     */
    this.Config = createXapiProxy(this, this.config);

    /**
     * Proxy for XAPI Event.
     */
    this.Event = createXapiProxy(this, this.event);

    /**
     * Proxy for XAPI Status.
     */
    this.Status = createXapiProxy(this, this.status);

    // Restrict object mutation
    if (options.seal) {
      Object.defineProperties(this, {
        Command: { writable: false },
        Config: { writable: false },
        Event: { writable: false },
        Status: { writable: false },
        config: { writable: false },
        event: { writable: false },
        feedback: { writable: false },
        status: { writable: false },
      });
      Object.seal(this);
    }

    backend
      .on('close', () => {
        this.emit('close');
      })
      .on('error', (error) => {
        this.emit('error', error);
      })
      .on('ready', () => {
        this.emit('ready', this);
      })
      .on('data', this.handleResponse.bind(this));
  }

  /**
   * Close the XAPI connection.
   *
   * @return {XAPI} - XAPI instance..
   */
  public close() {
    this.backend.close();
    return this;
  }

  /**
   * Executes the command specified by the given path.
   *
   * @example
   * // Space delimited
   * xapi.command('Presentation Start');
   *
   * // Slash delimited
   * xapi.command('Presentation/Start');
   *
   * // Array path
   * xapi.command(['Presentation', 'Start']);
   *
   * // With parameters
   * xapi.command('Presentation Start', { PresentationSource: 1 });
   *
   * // Multi-line
   * xapi.command('UserInterface Extensions Set', { ConfigId: 'example' }, `
   *  <Extensions>
   *    <Version>1.1</Version>
   *    <Panel item="1" maxOccurrence="n">
   *      <Icon>Lightbulb</Icon>
   *      <Type>Statusbar</Type>
   *      <Page item="1" maxOccurrence="n">
   *        <Name>Foo</Name>
   *        <Row item="1" maxOccurrence="n">
   *          <Name>Bar</Name>
   *          <Widget item="1" maxOccurrence="n">
   *            <WidgetId>widget_3</WidgetId>
   *            <Type>ToggleButton</Type>
   *          </Widget>
   *        </Row>
   *      </Page>
   *    </Panel>
   *  </Extensions>
   * `);
   *
   * @param {Array|string} path - Path to command node.
   * @param {Object} [params] - Object containing named command arguments.
   * @param {string} [body] - Multi-line body for commands requiring it.
   * @return {Promise} - Resolved with the command response when ready.
   */
  public command<T = any>(path: Path, params?: any, body?: string) {
    const apiPath = normalizePath(path).join('/');
    const method = `xCommand/${apiPath}`;
    const executeParams =
      body === undefined ? params : Object.assign({ body }, params);
    return this.execute<T>(method, executeParams);
  }

  /**
   * Execute the given JSON-RPC request on the backend.
   *
   * @example
   * xapi.execute('xFeedback/Subscribe', {
   *   Query: ['Status', 'Audio'],
   * });
   *
   * @param {String} method - Name of RPC method to invoke.
   * @param {Object} [params] - Parameters to add to the request.
   * @return {Promise} - Resolved with the command response.
   */
  public execute<T>(method: string, params: any): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = this.nextRequestId();
      const request = rpc.createRequest(id, method, params);
      this.backend.execute(request);
      this.requests[id] = { resolve, reject };
    });
  }

  /** @private */
  private handleResponse(response: XapiResponse) {
    const { id, method } = response;
    if (method === 'xFeedback/Event') {
      log.debug('feedback:', response);
      this.feedback.dispatch(response.params);
    } else {
      if ({}.hasOwnProperty.call(response, 'result')) {
        log.debug('result:', response);
        const { resolve } = this.requests[id];
        resolve(response.result);
      } else {
        log.debug('error:', response);
        const { reject } = this.requests[id];
        reject(response.error);
      }
      delete this.requests[id];
    }
  }

  /** @private */
  private nextRequestId() {
    const requestId = this.requestId;
    this.requestId += 1;
    return requestId.toString();
  }
}

export default XAPI;
