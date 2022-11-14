
exports.default = async function(value) {

  if (value === 4000) {
    throw new Error("4000 is not allowed");
  }

  if (value === 5000) {
    return Promise.reject("5000 is not allowed")
  }

  await new Promise((r) => setTimeout(r, 200));
  return value + 1;
}