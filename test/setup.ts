import * as chai from 'chai';
import dirtyChai from 'dirty-chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';

import logger from '../src/log';

logger.disableAll();

// Load plugins
chai.use(dirtyChai);
chai.use(chaiAsPromised);
chai.use(sinonChai);
