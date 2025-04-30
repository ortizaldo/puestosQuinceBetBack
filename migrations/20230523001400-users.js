module.exports = {
  async up(db, client) {
    const channels = ["email", "push", "sms"];
    const categories = await db.collection("categories").find({}).toArray();

    if (categories.length === 0) return false;

    await db.collection("users").insertMany([
      {
        name: "Anabelle Russell",
        email: "wihyb@tafmail.com",
        phoneNumber: "(933) 894-7005",
        subscribed: getRandomArray(categories).filter(
          (element, index) => index >= 2
        ),
        channels: getRandomArray(channels).filter(
          (element, index) => index >= 2
        ),
        createdAt: new Date(),
      },
      {
        name: "Marley Wall",
        email: "roxajuj@getairmail.com",
        phoneNumber: "(427) 354-8151",
        subscribed: getRandomArray(categories).filter(
          (element, index) => index < 2
        ),
        channels: getRandomArray(channels).filter(
          (element, index) => index < 2
        ),
        createdAt: new Date(),
      },
      {
        name: "Makaila Waller",
        email: "jaligofi@dropjar.com",
        phoneNumber: "(270) 854-1705",
        subscribed: getRandomArray(categories).filter(
          (element, index) => index == 2
        ),
        channels: getRandomArray(channels).filter(
          (element, index) => index == 2
        ),
        createdAt: new Date(),
      },
      {
        name: "Karly Charles",
        email: "varudex@getairmail.com",
        phoneNumber: "(645) 861-1927",
        subscribed: getRandomArray(categories),
        channels: getRandomArray(channels),
        createdAt: new Date(),
      },
      {
        name: "Nelson Randall",
        email: "xypyt@tafmail.com",
        phoneNumber: "(928) 764-8709",
        subscribed: getRandomArray(categories).filter(
          (element, index) => index === 0
        ),
        channels: getRandomArray(channels).filter(
          (element, index) => index === 0
        ),
        createdAt: new Date(),
      },
    ]);
  },

  async down(db, client) {
    // TODO write the statements to rollback your migration (if possible)
    // Example:
    // await db.collection('albums').updateOne({artist: 'The Beatles'}, {$set: {blacklisted: false}});
    await db.collection("users").deleteMany();
  },
};

function getRandomArray(arr) {
  const arrayClone = arr.slice();
  const randomArray = [];

  while (arrayClone.length > 0) {
    const randomIdx = Math.floor(Math.random() * arrayClone.length);
    const randomItem = arrayClone.splice(randomIdx, 1)[0];
    randomArray.push(randomItem._id ? randomItem._id : randomItem);
  }

  return randomArray;
}
