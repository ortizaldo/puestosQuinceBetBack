const config = {
  plugins: [
    [
      "module-resolver",
      {
        root: ["./src"],
      },
    ],
  ],
  presets: [
    [
      "@babel/preset-env",
      {
        targets: {
          esmodules: true,
        },
      },
    ],
  ],
  comments: false,
};

module.exports = config;
