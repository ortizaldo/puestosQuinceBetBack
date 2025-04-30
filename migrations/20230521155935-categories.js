module.exports = {
  async up(db, client) {
    // TODO write your migration here.
    // See https://github.com/seppevs/migrate-mongo/#creating-a-new-migration-script
    // Example:
    await db
      .collection("categories")
      .insertMany([
        { name: "Finance" },
        { name: "Sports" },
        { name: "Movies" },
      ]);
  },

  async down(db, client) {
    await db.collection("categories").deleteMany();
  },
};
