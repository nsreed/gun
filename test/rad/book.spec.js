const Book = require('../../lib/book');
const expect = require('../expect');

const BOOK_SPLIT_SIZE = 1000 * 1000;
const PAGE_SIZE = 2 ** 16;

const TRUTH = {};

for (let i = 0; i < 10000; i++) {
  const element = `word${i}`;
  TRUTH[element] = ''.padEnd(PAGE_SIZE, `value${i}`);
}
const JS_NUMBER_MAX = 9007199254740991;
const JS_NUMBER_MAX_PLUS_ONE = BigInt(JS_NUMBER_MAX) + BigInt(1);
const GUN_PRIMITIVES = [
  null,
  // {},
  // { key: 'value' },
  // { object: { key: 'value' } },
  '',
  'string',
  true,
  false,
  -Infinity,
  Infinity,
  NaN,
  -0, // FIXME javascript doesn't serialize this, fix manually with https://stackoverflow.com/questions/7223717/differentiating-0-and-0
  0,
  1,
  -1,
  1.0,
  -1.0,
  JS_NUMBER_MAX,
  JS_NUMBER_MAX + 1,
  JS_NUMBER_MAX_PLUS_ONE
];

async function run() {
  describe('book.js', () => {
    let b;

    // afterEach(() => {
    //   console.log(`list entries: ${b.list?.length}`);
    //   if (b.list) {
    //     const totalSize = b.list.reduce((p, c) => p + c.size, 0);
    //     console.log('total size', totalSize);
    //   }
    // });

    describe('basics', () => {
      beforeEach(() => {
        b = Book();
      });
      it('get gets nothing before its set', (done) => {
        expect(b('book')).to.not.be.ok();
        done();
      });
      it('get gets data that exists', done => {
        b('book', 'yes good');
        expect(b('book')).to.eql('yes good');
        done();
      });
      it('reads multiple values', done => {
        b('a', 'aval');
        b('b', 'bval');
        expect(b('a')).to.eql('aval');
        expect(b('b')).to.eql('bval');
        done();
      });


      describe('primitive values', () => {
        before(() => {
          b = Book();
        });
        GUN_PRIMITIVES.forEach(value => {
          it(`${typeof value} ${value}`, (done) => {
            const word = `${typeof value} (${value})`;
            b(word, value);
            const got = b(word);
            if (typeof value !== 'bigint' && isNaN(value)) {
              expect(isNaN(got)).to.eql(true);
            } else {
              expect(got).to.eql(value);
              expect(value === got).to.eql(true);
            }
            done();
          });
        });
      });
    });

    describe('read as writing', () => {
      before(() => {
        b = Book()
      });
      it('writes multiple values', done => {
        Object.entries(TRUTH).forEach(truth => {
          b(truth[0], truth[1]);
          const value = b(truth[0]);
          if (value !== truth[1]) {
            console.log('value did not match');
          }
          expect(value).to.eql(truth[1]);
        });
        done();
      });
    });

    describe('read after writing', () => {
      before(() => {
        b = new Book()
      });
      it('writes multiple values', done => {
        Object.entries(TRUTH).forEach(truth => {
          b(truth[0], truth[1]);
        });
        done();
      });
      it('reads multiple values', done => {
        Object.entries(TRUTH).forEach(truth => {
          const value = b(truth[0]);
          if (value !== truth[1]) {
            console.log('value did not match');
          }
          expect(value).to.eql(truth[1]);
        })
        done();
      });
    });

    describe('overwrite word', () => {
      before(() => {
        b = new Book();
      });
      it('writes initial value', () => {
        b('initial', 'z');
        expect(b('initial')).to.eql('z');
      });
      it('overwrites initial value', () => {
        b('initial', 'a');
        expect(b('initial')).to.eql('a');
      })
    });

    describe(`get('word')`, () => {
      it('word is null or undefined does not crash', done => {
        expect(b(null)).to.not.be.ok();
        expect(b(undefined)).to.not.be.ok();
        done();
      });
      it(`word.is is defined, should return word.is`, done => {
        expect(b({ is: 'truevalue' })).to.eql('truevalue');
        done();
      });
      it('word is present in book.all, send back has.is', done => {
        b.all['word'] = { is: 'trulypresent' };
        expect(b('word')).to.eql('trulypresent');
        done();
      });
      it.skip('page() gets splitting page and regets the page', done => {
        const bpdata = ''.padEnd(2 ** 26 + 1000, '0');
        const bmdata = ''.padEnd(2 ** 16 + 1000, '(>^.^)>');

        b('bigpage', bpdata);
        b('bigmage', bmdata); // this page should be too big
        expect(b('bigpage')).to.eql(bpdata);
        setTimeout(() => {
          console.log('grabbing page before split');
          const m1 = b.page('bigmage');
          b.split(b.list[0], b); // TODO? How to force a split without needing Book.split public?
          const p = b.page('bigpage');
          const m2val = b('bigmage');
          console.log('grabbing page after split');
          const m2 = b.page('bigmage'); // so when we get it, it should split?
          console.log({ m1, m2 });
          expect(m1).to.eql(m2);
          expect(p).to.be.ok(); // TODO? How to create a bug out of page() and splitting?
          expect(m1).to.be.ok();
          expect(m2).to.be.ok();
          done();
        }, 800);
      });
    });
  });

  // const b = Book();
  // b.list = Book.slot(`|'!'|`);

  // const setRet = b(`book`, 'a thrilling story');
  // console.log({ setRet });
  // const getRet = b(`book`);
  // console.log({ getRet });


}

run();