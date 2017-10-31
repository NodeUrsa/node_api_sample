import Email from '../../lib/email'
import _ from 'highland'
import sinon from 'sinon'

export var EmailMockInner = {
  to: sinon.spy( () => _([{}]) ),
};

export var EmailMock = {
  send: sinon.spy( () => EmailMockInner ),
};

export default function mockOutEmail ( adm ) {
  adm.provide( Email, EmailMock );

  EmailMock.send.reset();
  EmailMockInner.to.reset();
};

