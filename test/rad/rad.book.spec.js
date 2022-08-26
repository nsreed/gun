/**
 * radisk3/book sanity tests
 * - long paths
 * - long data
 * - special characters
 * - escape sequences
 * - __proto__ pollution
 */
const expect = require('../expect');
const path = require('path');
const fs = require('fs');

const ENABLE_GUN_LOGGING = process.env.ENABLE_GUN_LOGGING ?? false;
const SKIP_CHARS = process.env.SKIP_CHARS ?? false;
const KEEP_DATA = process.env.KEEP_DATA ?? true;
const CHAR_MAX = 330;
const UNPRINTABLE_MAX = 128; //65536;
const JS_NUMBER_MAX = 9007199254740991;
const JS_NUMBER_MAX_PLUS_ONE = BigInt(JS_NUMBER_MAX) + BigInt(1);

const FS_PATH_MAX_LENGTH = 4096;
const FS_NAME_MAX_LENGTH = 255;


const DATA_LENGTHS = [
  10,
  100,
  1000, // 1kb
  3000, // 3kb
  10000,
  100000,
  1000000, // 1 mb
  10000000, // 10mb
  50000000, // 50mb
  // 500000000, // 500mb
];

const PATH_TO_TEST_FOLDER = path.resolve(__dirname, 'booktestdata');
const PATH_TO_TEST_DB = path.resolve(PATH_TO_TEST_FOLDER, 'radatatest');
const PATH_TO_OLD_DB = path.resolve(PATH_TO_TEST_FOLDER, 'oldradata');
const PATH_TO_TEST_DB2 = path.resolve(PATH_TO_TEST_FOLDER, 'radatatest2');


const BOOK_SPECIAL_CHARS = ['\'|', '|\'', '|', '\'', '\n'];
const BOOK_PAGE_SIZE = 3000;

const PATH_SEGMENTS = ['a', 'b'];
const RAD_PATH_SEPARATORS = ['/', '.'];



const RE_UNPRINTABLE = /[^\x20-\x7E]/;
const RE_APOSTROPHES = /'/g;
const ALL_CHARS = [];
for (let i = 0; i < CHAR_MAX; i++) {
  ALL_CHARS.push(String.fromCharCode(i));
}
ALL_CHARS.push('\u001b');
const PRINTABLE_CHARS = ALL_CHARS.filter(c => !RE_UNPRINTABLE.test(c));
const UNPRINTABLE_CHARS = ALL_CHARS.filter(c => RE_UNPRINTABLE.test(c)).slice(0, UNPRINTABLE_MAX);
const ESCAPE_CHARS = [`\0`, `\u001b`, `\\`, `\\\\`, `\\\\\\`, `\\\\\\\\`, '$`'];
const NORMAL_CHARS = ['A', 'B', 'C'];

const ESCAPE_FACTORIES = {
  ESCAPE_AS_NODE: (before, ec, c, after) => {
    ec = ec.length ? [ec] : [];
    return [...before, ...ec, c, ...after];
  },
  ESCAPE_IN_PATH: (before, ec, c, after) => [...before, `${ec}${c}`, ...after],
  ESCAPE_AT_END: (before, ec, c, after) => {
    ec = ec.length ? [ec] : [];
    return [...before, `${c}`, ...after, ...ec];
  }
};

const ESCAPED_SPECIALS = BOOK_SPECIAL_CHARS.reduce((pe, cs) => [...pe, ESCAPE_CHARS.map(ec => `${ec}${cs}`)], []);
const SOUL_GAUNTLET = RAD_PATH_SEPARATORS
  .reduce((pc, ps) => [...pc, ...[...BOOK_SPECIAL_CHARS, ...ESCAPE_CHARS, ...ESCAPED_SPECIALS].reduce((pb, cb) =>
    [...pb,
    NORMAL_CHARS.map((nc) => `${nc}${cb}`),
    NORMAL_CHARS.map((nc) => `${cb}${nc}`),
    NORMAL_CHARS.map((nc) => `${cb}${cb}${nc}`),
    ], []).map(s => s.join(ps))], []);

const OPT_DEFAULTS = {
  file: PATH_TO_TEST_DB,
  localStorage: false,
  chunk: 1000
};
(function () {
  var root;
  var Gun;
  var Radix;
  var Radisk;
  var RFS;
  var Store;
  var env;
  if (typeof global !== 'undefined') { env = global }
  if (typeof window !== 'undefined') { env = window }
  root = env.window ? env.window : global;

  try { var expect = root.expect = require("../expect") } catch (e) { }
  try { env.window && root.localStorage && root.localStorage.clear() } catch (e) { }
  //try{ indexedDB.deleteDatabase('radatatest') }catch(e){}
  if (root.Gun) {
    root.Gun = root.Gun;
    // root.Gun.TESTING = true;
  } else {
    try { require('fs').unlinkSync('data.json') } catch (e) { }
    try { require('../../lib/fsrm')(PATH_TO_TEST_DB) } catch (e) { }
    root.Gun = require('../../gun');
    root.Gun.TESTING = true;
    Gun = root.Gun;
  }
  require("../../lib/book");
  Radix = Gun?.window?.Radix || require("../../lib/radix");
  Radisk = Gun?.window?.Radisk || require("../../lib/radisk3");
  RFS = Gun?.window?.RFS || require('../../lib/rfs');
  require('../../lib/store');
  require('../../lib/rindexed');

  if (!root.Gun.SEA) {
    require('../../sea.js');
  }

  let seq = 0;

  describe('radisk3 & book', () => {
    console.log('starting!!!!!!!!!');
    let r;

    before(done => {
      if (!fs.existsSync(PATH_TO_TEST_FOLDER)) {
        fs.mkdirSync(PATH_TO_TEST_FOLDER);
      }
      unpersist();
      done();
    });

    after(() => {
      if (!KEEP_DATA) {
        unpersist();
      }
    });

    describe.skip('backwards compatibility', () => {
      it('can read older file versions', done => {
        done('not implemented');
      });
    });

    it('no callback for read', done => {
      r = buildRad();
      r('initialize', true, () => {
        r('initialize');
        r('test', '2', () => {
          r('test');
        });
      });
      // r('initialize');
      done();
    })

    describe('path', () => {
      describe('overwrite', () => {
        before((done) => {
          unpersist();
          r = buildRad();
          done();
        });
        it('writes initial value', done => {
          r('initial', 'value', done);
        });
        it('reads initial value', done => {
          r('initial', (err, page, book) => {
            expect(err).to.not.be.ok();
            expect(page).to.be.ok();
            expect(book).to.be.ok();
            expect(book('initial')).to.eql('value');
            done();
          })
        });
        it('overwrites initial value', done => {
          r('initial', 'new value', done);
        });
        it('reads new value', done => {
          r('initial', (err, page, book) => {
            expect(err).to.not.be.ok();
            expect(page).to.be.ok();
            expect(book).to.be.ok();
            expect(book('initial')).to.eql('new value');
            done();
          })
        })
      });
      [true, false].forEach(reset => {
        [false, true].forEach(readonly => {
          describe(`consecutive ${readonly ? 'read' : 'write+read'} using ${reset ? 'new' : 'existing'} Radisk`, () => {
            if (!reset && !readonly) {
              before(() => unpersist());
            }
            (reset ? beforeEach : before)(() => {
              r = buildRad();
            });
            if (!readonly) {
              it('writes a', done => {
                r('a', 'a', () => {
                  r('a', done);
                })
              });
              it('writes b', done => {
                r('b', 'b', () => {
                  r('b', (err, page, book) => {
                    done();
                  });
                })
              });
            }
            it('reads a', done => {
              r('a', (err, page, book) => {
                expect(book('a')).to.eql('a');
                done();
              })
            });
            it('reads b (using test wrapper)', done => {
              r('b', (err, page, book) => {
                const v = getValueFromPage('b', page);
                if (v !== 'b') {
                  done('values did not match');
                  return;
                }
                done();
              })
            });
            it('reads b (using book())', done => {
              r('b', (err, page, book) => {
                const v = book('b', page);
                if (v !== 'b') {
                  done('values did not match');
                  return;
                }
                done();
              })
            });
          })
        })
      });

      describe('lengths', function () {
        before((done) => {
          unpersist();
          r = buildRad();
          r('init', done);
        });
        [1000, 10000000].forEach(dataLength => {
          [127, 255, BOOK_PAGE_SIZE - 10, BOOK_PAGE_SIZE, FS_PATH_MAX_LENGTH + FS_NAME_MAX_LENGTH + 2, FS_PATH_MAX_LENGTH * 10].forEach(pathLength => {
            // TODO? Ask mark about path hashing, should it be expected to be a thing with book, because book incurs conversion cost anyway
            const word = ''.padEnd(pathLength, `${pathLength}`);
            const value = ''.padEnd(dataLength, `${pathLength}value`);
            it(`writes path length ${pathLength} with data length ${dataLength}`, done => {
              r(word, value, (...args) => {
                // console.log({ args });
                // r2 = buildRad();
                r(word, (err, page, book) => {
                  const value = book(word);
                  expect(value).to.eql(value);
                  done();
                });
              });
              // done('not implemented');
            });
            it(`read path length ${pathLength} with data length ${dataLength}`, done => {
              r(word, (err, page, book) => {
                const value = book(word);
                if (value !== value) {
                  console.log('unexpected value');
                }
                expect(value).to.eql(value);
                done();
              });
            });
          });
        });

        describe('longer than 255 (truncated)', () => {
          before(() => {
            r = buildRad();
          })
          const pathLength = 255;
          const dataLength = 1000000;
          const word = ''.padEnd(pathLength, `${pathLength}`) + 'a';
          const word2 = ''.padEnd(pathLength, `${pathLength}`) + 'b';
          const value = ''.padEnd(dataLength, `${pathLength}valuea`);
          const value2 = ''.padEnd(dataLength, `${pathLength}valueb`);
          it('writes', done => {
            r(word, value, () => {
              r(word, done);
            })
          });
          it('reads', done => {
            r(word, (err, page, book) => {
              const got = book(word);
              expect(got).to.be.ok();
              if (got !== value) {
                done('values did not match');
                return;
              }
              done();
            })
          });
          it('writes distinct path past 255', done => {
            r(word2, value2, () => {
              r(word2, done);
            })
          });
          it('reads distinct path past 255', done => {
            r(word2, (err, page, book) => {
              const v = book(word2);
              if (v !== value2) {
                done('values did not match');
                return;
              }
              done();
            })
          });
        });
      });

      describe('separators', () => {
        beforeEach(() => {
          unpersist();
          r = buildRad();
        })
        RAD_PATH_SEPARATORS.forEach(s => {
          it(`supports '${s}' as a separator`, done => {
            const soul = PATH_SEGMENTS.join(s);
            r(soul, soul);
            r(soul, (err, page, book) => {
              expect(getValueFromPage(soul, page)).to.eql(soul);
              done();
            });
          });
          it('should separate two keys', (done) => {
            seq++;
            let soul = `a${seq}${s}a`;
            let data = `data for '${soul}' ${seq}`;
            r(soul, data);
            r(soul, (err, res, o) => {
              const rd = getValueFromPage(soul, res);
              expect(rd).to.be.ok();
              expect(rd).to.eql(data);
              done();
            });
          });
        });
      })

      return;
      describe('special characters in path', () => {
        beforeEach(() => {
          r = buildRad();
        });
        SOUL_GAUNTLET.forEach((soul, si) => {
          it(`#:${si + 1} of ${SOUL_GAUNTLET.length}`, done => {
            r(soul, soul);

            r(soul, (err, page, book) => {
              expect(getValueFromPage(soul, page)).to.eql(soul);
              done();
            })
          });
        });
      });
    });

    describe('data', () => {

      beforeEach(() => {
        r = buildRad();
      });
      it('can write & read data spanning multiple pages', done => {
        done('not implemented');
      });
      describe('primitives', () => {

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
        ]; // TODO? Are these all the primitives you got?


        GUN_PRIMITIVES.forEach(value => {
          describe(`${typeof value} (${value})`, () => {
            before(() => {
              unpersist();
              r = buildRad();
            });
            const name = `type ${typeof value} value ${value}`;
            it(`writes ${typeof value} (${value})`, done => {
              r(name, value, () => {
                r(name, (err, page, book) => {
                  const result = book(name);
                  expect(typeof result).to.eql(typeof value);
                  if (typeof value !== 'bigint' && isNaN(value)) {
                    expect(isNaN(result)).to.eql(true);
                  } else {
                    expect(result === value).to.eql(true);
                    expect(result).to.eql(value);
                  }
                  done();
                });
              });
            });

            it(`reads ${typeof value} (${value})`, done => {
              r(name, (err, page, book) => {
                const result = book(name);
                expect(typeof result).to.eql(typeof value);
                if (typeof value !== 'bigint' && isNaN(value)) {
                  expect(result === value).to.eql(true);
                  expect(isNaN(result)).to.eql(true);
                } else {
                  expect(result).to.eql(value);
                }
                done();
              });
            });
          })

        });
        it.skip('should store numbers larger than 9007199254740992 as BigInt?', (done) => {
          // TODO? mark - does this make sense? it could cause peers running on different JS engines architectures to give different results
          // If so, this might be a case to run with PANIC as well
          done('indeterminate');
        });
      });
      it('can write & read objects', done => {
        r('object', { test: 'works' });
        r('object', (err, page, book) => {
          const value = getValueFromPage('object', page);
          expect(value).to.be.ok();
          expect(value.test).to.eql('works');
          done();
        })
      });
      // it('might be able to page where soul length exceeds max page size', done => {
      //   done();
      // });
      // it('can page with special characters at beginning and end of page', done => {
      //   // generate a thing that is as big as a 
      //   const bigthing = ''.padEnd(BOOK_PAGE_SIZE, '12345');
      //   r('bigkey', bigthing, () => {
      //     done();
      //   });
      // });
    });

    const soulpermutations = [];
    describe('RAD book', () => {
      let r;
      let writeTimer;

      const LONG_DATAS = DATA_LENGTHS.map(l => ''.padEnd(l, `${l}B `));
      describe('node content length & paging', () => {
        beforeEach((done) => {
          r = buildRad();
          r('initialize', () => {
            r = timeRad(r);
            done();
          });
          // console.log(r.book);
          // expect(r.book).to.be.ok();
          // done();
        });
        LONG_DATAS.forEach((d) => {
          const dk = `length.${d.length}B`;
          it(`writes data length of ${d.length} bytes`, (done) => {
            seq++;
            // console.log(`\n#[${dk}]\n`);
            // writeTimer = timer(`${d.length} bytes write`);
            r(dk, d, (err, ok) => {
              if (err) {
                console.log('ERR! waiting for ${dk} to write', err);
                done(false);
                return;
              }
              // writeTimer(true);
              // const readTimer = timer(`${d.length} bytes read`)
              r(dk, (err, res, o) => {
                // readTimer(true);

                const value = getValueFromPage(dk, res);
                if (!res) {
                  // console.log('no result', { err, res, o });
                  done('nothing returned');
                  return;
                }
                if (d !== value) {
                  done('result did not match');
                  // TODO is this a failure, or because I'm not reading the result properly?
                  // TODO when a split() happens, should that affect the resulting page?
                  return;
                }
                done();
              });
            });
            // console.time('test');
            // console.timeEnd('test');
          });
          it(`reads data length of ${d.length} bytes`, done => {
            r(dk, (err, page, book) => {

              done();
            });
          })
        });
      });
      return;
      if (!SKIP_CHARS) {
        describe('other delimited paths', () => {
          RAD_PATH_SEPARATORS.forEach((d, di) => {
            const charCats = { PRINTABLE_CHARS };
            Object.entries(charCats).forEach((ckv) => {
              const PATH_CHARS = ckv[1];
              Object.keys(ESCAPE_FACTORIES).forEach(escapeVariantKey => {
                ESCAPE_CHARS.forEach(ec => {
                  describe(`${ckv[0]} '${escape(ec)}' ${escapeVariantKey}`, () => {
                    let rootKey;

                    beforeEach(() => {
                      r = buildRad();
                    });

                    PATH_CHARS.forEach((c, i) => {
                      for (let si = 0; si <= PATH_SEGMENTS.length; si++) {
                        const beginning = PATH_SEGMENTS.slice(0, si);
                        const end = PATH_SEGMENTS.slice(si);
                        const variant = [...ESCAPE_FACTORIES[escapeVariantKey](beginning, ec, c, end)];
                        const soul = variant.join(d);
                        soulpermutations.push(soul);
                        // variant[0] = `${variant[0]}${seq}`;
                        let data = `data for ${soul} ${seq}`;

                        const numericSoul = soul.split('').map(x => `${x.charCodeAt(0)}`.padStart(6, ' ')).join('');

                        it(`book ${seq} ${numericSoul} # (${soul}) => ${data}`, (done) => {
                          seq++;
                          r(soul, data);
                          r(soul, (err, res, book) => {
                            if (err) {
                              done(err);
                              return;
                            }
                            const value = book(soul); // getValueFromPage(soul, res); // TODO mark fix this
                            if (value !== data) {
                              console.log(`values didn't match`);
                            }
                            expect(value).to.eql(data);
                            done();
                          });
                        });

                        it(`manual ${seq} ${numericSoul} # (${soul}) => ${data}`, (done) => {
                          seq++;
                          r(soul, data);
                          r(soul, (err, page, book) => {
                            if (err) {
                              done(err);
                              return;
                            }
                            const value = getValueFromPage(soul, page); // getValueFromPage(soul, res); // TODO mark fix this
                            if (value !== data) {
                              console.log(`values didn't match`);
                            }
                            expect(value).to.eql(data);
                            done();
                          });
                        });
                      }
                    });
                  });
                });
              });
            });
          });
        });
      }
    });
  });


  function testDirExists() {
    return fs.readdirSync(PATH_TO_TEST_FOLDER).includes('radatatest');
  }

  function unpersist(opt) {
    opt = opt || { file: PATH_TO_TEST_DB };
    opt.file = opt.file || PATH_TO_TEST_DB;
    delete RFS[opt.file];
    fs.rmdirSync(opt.file, { recursive: true });
  }

  function timeRad(r) {
    const ro = r;
    function rTimingWrapper(...args) {
      const cid = `${args[0]}`;
      const cbidx = args.indexOf(args.find(a => 'function' === typeof a));
      const callType = [-1, 1].includes(cbidx) ? 'read' : 'write';
      // console.log(`${cid} ${callType}`);
      const returnTimer = timer(`${cid} ${callType} return`);
      const callbackTimer = timer(`${cid} ${callType} callback`);
      const ret = ro(...args.map((a, i) => 'function' === typeof a ? (...cba) => {
        // console.log(`callback ${cid}`, i);
        callbackTimer(true);
        a(...cba);
      } : a));
      returnTimer(false);
      return ret;
    }
    return rTimingWrapper;
  }

  function buildOpt(overrides) {
    overrides = overrides || {};
    const opt = {
      ...OPT_DEFAULTS, ...overrides
    };
    opt.log = (msg, ...args) => {
      if (ENABLE_GUN_LOGGING) {
        console.log(`  ${msg}`, ...args);
      }
    };
    delete RFS[opt.file];
    opt.store = RFS(opt);
    return opt;
  }

  function buildRad(overrides = {}) {
    const opts = buildOpt(overrides);
    return Radisk(opts);
  }


  function timer(name = 'default') {
    const start = Date.now();
    return (announce = false) => {
      const elapsed = Date.now() - start;
      announce && console.log('%s took %dms', name, elapsed);
      return elapsed;
    };
  }
}(this));



function findInList(list, word) {
  return (list || []).find(b => b.word === word);
}
function getValueFromPage(soul, res) {
  // return res;
  // console.log(`getting ${soul} from`, res);
  const bookList = res?.list || res?.book.list;
  if (!bookList) {
    return null;
  }
  const book = findInList(bookList, soul);
  if (!book || !book.is) {
    return null;
  }
  return book.is;
}