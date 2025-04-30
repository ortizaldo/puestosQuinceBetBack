const init = async () => {
  // Service worker
  try {
    const category = await fetch("/api/category", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!category.ok) {
      throw new Error(`Error! status: ${category.status}`);
    }

    const resultCat = await category.json();
    fillSelect(resultCat.data.categories);
  } catch (error) {
    console.log("%cmain.js line:54 error", "color: #007acc;", error);
  }
};

const form = document.querySelector("#myform");
const message = document.querySelector("#message");
const category = document.querySelector("#category");
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const responseLog = await fetch("/api/notification/send-message/", {
    method: "POST",
    body: JSON.stringify({ message: message.value, category: category.value }),
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!responseLog.ok) {
    throw new Error(`Error! status: ${responseLog.status}`);
  }

  const result = await responseLog.json();
  fillTbl(result.data);

  form.reset();
});

const fillTbl = (data) => {
  $("#log tbody").empty();
  let items = "";
  _.each(data, function (log) {
    items += `<tr value="${log._id}">
          <td>${log.user.name}</td>
          <td>${log.user.email}</td>
          <td>${log.user.phoneNumber}</td>
          <td>${log.category.name}</td>
          <td>${log.channel}</td>
          <td>${log.message}</td>
          <td>${moment(log.createdAt).format("YYYY-MM-DD HH:MM:ss")}</td>
        </tr>`;
  });

  $("#log tbody").append(items);
};

const fillSelect = (data) => {
  const items = [];
  data.map((category) => {
    items.push(
      `<option value="${category._id}">
          ${category.name}
        </option>`
    );
  });

  $("#category").append(items.join(""));
};

init();
