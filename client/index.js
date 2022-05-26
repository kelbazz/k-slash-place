const ws = new WebSocket("wss:///1309.kelbaz.webide.se");

const colors = ["white", "black", "blue", "red", "yellow", "green"];
const colorDiv = document.querySelector(".colors");
const root = document.querySelector(":root");
const overlay = document.querySelector(".canva-overlay");
const canva = document.querySelector(".canva");
const timerEl = document.querySelector(".timer");
let timer = 0;
let currentColor = 0;

root.style.setProperty("--tile-size", "10px");
root.style.setProperty("--tile-x", "0");
root.style.setProperty("--tile-y", "0");

overlay.addEventListener("mousewheel", (e) => {
  const rootStyle = document.querySelector(":root").style;
  const tileSize = parseInt(rootStyle.getPropertyValue("--tile-size"));

  if (e.deltaY < 0 && tileSize <= 95) {
    rootStyle.setProperty("--tile-size", `${tileSize + 5}px`);
  } else if (e.deltaY > 0 && tileSize >= 10) {
    rootStyle.setProperty("--tile-size", `${tileSize - 5}px`);
  }
});

const mousePos = { x: 0, y: 0 };
function mousedown(e) {
  overlay.style.cursor = "grabbing";
  mousePos.x = e.clientX;
  mousePos.y = e.clientY;

  overlay.addEventListener("mouseup", mouseup);
  overlay.addEventListener("mousemove", mousemove);
}

function mousemove(e) {
  e.preventDefault();
  canva.style.pointerEvents = "none";
  const tileX = parseInt(root.style.getPropertyValue("--tile-x"));
  const tileY = parseInt(root.style.getPropertyValue("--tile-y"));

  root.style.setProperty("--tile-x", `${tileX + (e.clientX - mousePos.x)}px`);
  root.style.setProperty("--tile-y", `${tileY + (e.clientY - mousePos.y)}px`);

  mousePos.x = e.clientX;
  mousePos.y = e.clientY;
}

function mouseup() {
  overlay.style.cursor = "grab";
  canva.style.pointerEvents = "auto";
  overlay.removeEventListener("mousemove", mousemove);
  overlay.removeEventListener("mouseup", mouseup);
}

overlay.addEventListener("mousedown", mousedown);

colors.forEach((color, index) => {
  const colorTile = document.createElement("div");

  if (!document.querySelector(".current-color"))
    colorTile.classList.add("current-color");

  colorTile.addEventListener("click", () => {
    if (document.querySelector(".current-color")) {
      document
        .querySelector(".current-color")
        .classList.remove("current-color");
    }

    colorTile.classList.add("current-color");
    currentColor = index;
  });

  colorTile.style.padding = "10px";
  colorTile.classList.add("tile");
  colorTile.style.backgroundColor = color;
  colorDiv.appendChild(colorTile);
});

ws.addEventListener("open", () => {
  ws.send(
    JSON.stringify({
      req: "getCanvaData",
    })
  );
});

let firstTime = true;
ws.addEventListener("message", (e) => {
  const data = JSON.parse(e.data);
  if (data.type === "getCanvaData") {
    const canvaData = data.res;
    const div = document.querySelector(".canva");

    canvaData.forEach((column, i) => {
      column.forEach((row, j) => {
        if (firstTime) {
          const tile = document.createElement("div");
          tile.classList.add("tile");
          tile.dataset.position = j + "," + i;

          tile.style.backgroundColor = colors[row] || colors[0];
          div.appendChild(tile);
        } else {
          const tile = document.querySelector(`[data-position="${j},${i}"]`);
          tile.style.backgroundColor = colors[row];
        }
      });
      div.innerHTML += "<br>";
    });

    document.querySelectorAll(`.tile[data-position]`).forEach((tile) => {
      const i = tile.dataset.position.split(",")[0];
      const j = tile.dataset.position.split(",")[1];

      tile.addEventListener("click", function () {
        console.log(j, i, colors[currentColor]);
        ws.send(
          JSON.stringify({
            req: "place",
            data: [i, j, currentColor],
          })
        );
        if (timer <= 0) {
          timer = 29;
          const interval = setInterval(() => {
            if (timer <= 0) {
              timerEl.innerText = "Ready";
              clearInterval(interval);
            } else {
              timerEl.innerText = timer-- + "s";
            }
          }, 1000);
        }
      });

      tile.addEventListener("mouseover", () => {
        document.querySelector(".mouse-pos").innerHTML = tile.dataset.position;
      });
    });

    if (firstTime) {
      firstTime = false;
    }
  }
});
