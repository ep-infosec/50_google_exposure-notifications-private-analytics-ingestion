// Copyright 2020 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
const firebase = require('@firebase/testing');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const projectId = "emulator-test-project"
const adminApp = firebase.initializeAdminApp({ projectId: projectId });

beforeAll(async () => {
  await firebase.loadFirestoreRules({
    projectId: projectId,
    rules: fs.readFileSync("firestore.rules", "utf8")
  });
  const doc = adminApp.firestore().collection('uuid').doc('preexisting')
                .collection('2020-09-03-13').doc('fakeMetric-v1');
  await doc.set({
    'payload': {
      'created': firebase.firestore.FieldValue.serverTimestamp(),
      'uuid': 'preexisting',
     }
  });
});

function getPath(date) {
  return date.toISOString().split('T')[0] + "-"
       + date.toISOString().split('T')[1].split(':')[0];
}

function correctContents(uuid = 'foo') {
  return {
     'payload': {
       'created': firebase.firestore.FieldValue.serverTimestamp(),
       'uuid': uuid,
       'schemaVersion': '1',
       'encryptedDataShares': [
         {
          'payload': 'payload1',
          'encryptionKeyId': 'key1'
         },
         {
          'payload': 'payload2',
          'encryptionKeyId': 'key2'
         }
       ],
       'prioParams': {
         'bins': 1,
         'epsilon': 2,
         'hammingWeight': 3,
         'numberServers': 2,
         'prime': 5
       }
      },
      'certificateChain': ['cert1', 'cert2', 'cert3'],
      'signature': 'sig'
   };
}

describe('Tests of document writes and access', () => {
  const app = firebase.initializeTestApp({
    projectId: projectId,
    auth: null
  });
  const db = app.firestore()
  const datefmt = getPath(new Date());
  it('document cannot be written at wrong path',
      async () => {
        const doc = db.collection('random').doc('wrongpath');
        await firebase.assertFails(doc.set(correctContents()));
      });
  it('document cannot be written without payload',
      async () => {
        const doc = db.collection('uuid').doc('nopayload')
                      .collection(datefmt).doc('fakeMetric-v1');
        contents = correctContents('nopayload');
        delete contents['payload'];
        await firebase.assertFails(doc.set(contents));
      });
  it('document cannot be written without uuid',
      async () => {
        const doc = db.collection('uuid').doc('nouuidfield')
                      .collection(datefmt).doc('fakeMetric-v1');
        contents = correctContents();
        delete contents['payload']['uuid'] ;
        await firebase.assertFails(doc.set(contents));
      });
  it('document cannot be written without created field',
      async () => {
        const doc = db.collection('uuid').doc('nocreated')
                      .collection(datefmt).doc('fakeMetric-v1');
        contents = correctContents('nocreated');
        delete contents['payload']['created'];
        await firebase.assertFails(doc.set(contents));
      });
  it('document cannot be written with extraneous field',
      async () => {
        const doc = db.collection('uuid').doc('extraneous')
                      .collection(datefmt).doc('fakeMetric-v1');
        contents = correctContents('extraneous');
        contents['payload']['prioParams']['banana'] = "extra field";
        await firebase.assertFails(doc.set(contents));
      });
  it('documents cannot be created at very old path',
      async () => {
        var oldDate = new Date();
        oldDate.setHours(oldDate.getHours() - 2);
        const doc = db.collection('uuid').doc('old')
                      .collection(getPath(oldDate)).doc('fakeMetric-v1');
        await firebase.assertFails(doc.set(correctContents('old')));
      });
  it('documents cannot be created with very large uuids',
      async () => {
        longuuid = 'x'.repeat(1000);
        const doc = db.collection('uuid').doc(longuuid)
                      .collection(datefmt).doc('fakeMetric-v1');
        contents = correctContents(longuuid);
        contents['payload']['uuid'] = longuuid;
        await firebase.assertFails(doc.set(contents));
      });
  it('documents cannot be created with very large signatures',
      async () => {
        const doc = db.collection('uuid').doc('longsig')
                      .collection(datefmt).doc('fakeMetric-v1');
        contents = correctContents('longsig');
        contents['signature'] = 'x'.repeat(1000);
        await firebase.assertFails(doc.set(contents));
      });
  it('documents cannot be created with very long certificate chains',
      async () => {
        const doc = db.collection('uuid').doc('longchain')
                      .collection(datefmt).doc('fakeMetric-v1');
        contents = correctContents('longchain');
        contents['certificateChain'] = Array(12).fill('cert')
        await firebase.assertFails(doc.set(contents));
      });
  it('documents cannot be created with a large certificate',
      async () => {
        const doc = db.collection('uuid').doc('longcert')
                      .collection(datefmt).doc('fakeMetric-v1');
        contents = correctContents('longcert');
        contents['certificateChain'].push('x'.repeat(50000));
        await firebase.assertFails(doc.set(contents));
      });
  it('correct documents can be created',
      async () => {
        const doc = db.collection('uuid').doc('correct1')
                      .collection(datefmt).doc('fakeMetric-v1');
        await firebase.assertSucceeds(doc.set(correctContents('correct1')));
      });
  it('documents can be created at slightly off path',
      async () => {
        var oldDate = new Date();
        oldDate.setHours(oldDate.getHours() - 1);
        const doc = db.collection('uuid').doc('correct2')
                      .collection(getPath(oldDate)).doc('fakeMetric-v1');
        await firebase.assertSucceeds(doc.set(correctContents('correct2')));
      });
  it('documents can be created at sharded top level collection',
      async () => {
        var oldDate = new Date();
        oldDate.setHours(oldDate.getHours() - 1);
        const doc = db.collection('uuid24').doc('correct3')
                      .collection(getPath(oldDate)).doc('fakeMetric-v1');
        await firebase.assertSucceeds(doc.set(correctContents('correct3')));
      });
  it('document cannot be deleted',
      async () => {
        const doc = db.collection('uuid').doc('preexisting')
                      .collection('2020-09-03-13').doc('fakeMetric-v1');
        await firebase.assertFails(doc.delete());
      });
  it('document cannot be updated',
      async () => {
        const doc = db.collection('uuid').doc('preexisting')
                      .collection('2020-09-03-13').doc('fakeMetric-v1');
        await firebase.assertFails(doc.update(correctContents('preexisting')));
      });
  it('document cannot be read',
      async () => {
        const doc = db.collection('uuid').doc('preexisting')
                      .collection('2020-09-03-13').doc('fakeMetric-v1');
        await firebase.assertFails(doc.get());
      });
  it('check final state of firestore',
      async () => {
        const querySnapshot = await adminApp.firestore()
                                .collectionGroup('uuid').get();
        foundUuids = []
        querySnapshot.forEach((doc) => {
          foundUuids.push(doc.data()['payload']['uuid']);
        });
        assert.notStrictEqual(foundUuids,
                [ 'correct1', 'correct2', 'correct3', 'preexisting' ])
      });
});
