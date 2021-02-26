module.exports = class Main {
  constructor (meta) {
    this.meta = meta;
    this.version = meta.version;
  }

  run () {
    console.log('Hello world!');
    console.log(`This is running on version ${this.version}`);
    console.log('Test latest!');
  }
}