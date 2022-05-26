async function handle(conn: Deno.Conn) {
  const httpConn = Deno.serveHttp(conn);
  for await (const requestEvent of httpConn) {
    await requestEvent.respondWith(handleReq(requestEvent.request, conn));
  }
}

function createLog(message: string, remoteAddr: Deno.NetAddr) {
  const logTemplate = `[${
    new Date().toLocaleString("fr")
  }] (${remoteAddr.hostname}) ${message}`;

  console.log(logTemplate);
  // Deno.writeTextFileSync(
  //   "server.log",
  //   Deno.readTextFileSync("server.log") +
  //     logTemplate + "\n",
  // );
}

const sockets: Array<WebSocket> = [];

function handleReq(req: Request, conn: Deno.Conn): Response {
  const upgrade = req.headers.get("upgrade") || "";
  if (upgrade.toLowerCase() != "websocket") {
    return new Response("request isn't trying to upgrade to websocket.");
  }
  const { socket, response } = Deno.upgradeWebSocket(req);
  const remoteAddr = conn.remoteAddr as Deno.NetAddr;

  socket.onopen = () => {
    createLog("Socket connected.", remoteAddr);
    const users = JSON.parse(Deno.readTextFileSync("users.json"));

    users.forEach(
      (user: { ip: string; lastPlaceTime: number }, index: number): void => {
        if (user.ip === remoteAddr.hostname) return;
        else if (index - 1 >= users.length) {
          users.push({
            ip: remoteAddr.hostname,
            lastPlaceTime: null,
          });
        }
      },
    );

    Deno.writeTextFileSync("users.json", JSON.stringify(users));

    if (!sockets.includes(socket)) sockets.push(socket);
  };
  socket.onmessage = (e) => {
    // deno-lint-ignore no-explicit-any
    let reqJson: { req: string; data: any };
    try {
      reqJson = JSON.parse(e.data);
    } catch {
      return socket.send(JSON.stringify({
        type: "error",
      }));
    }

    if (reqJson.req === "getCanvaData") {
      socket.send(
        JSON.stringify({
          type: "getCanvaData",
          res: JSON.parse(Deno.readTextFileSync("canva.json")),
        }),
      );
      createLog("Socket asked for canva data.", remoteAddr);
    }

    if (reqJson.req === "place") {
      createLog("Socket asked for placing: " + reqJson.data.join(", ") + ".", remoteAddr);

      const users = JSON.parse(Deno.readTextFileSync("users.json"));
      users.forEach(
        (user: { ip: string; lastPlaceTime: number }, index: number) => {
          if (
            user.ip === remoteAddr.hostname /* &&
            (Date.now() - user.lastPlaceTime >= 30000 ||
              user.lastPlaceTime === null) */
          ) {
            if (!reqJson.data) {
              createLog(`${reqJson.data.join(", ")}: Placement refused.`, remoteAddr);
              return socket.send(JSON.stringify({ type: "error" }));
            }
            const canva = JSON.parse(Deno.readTextFileSync("canva.json"));
            canva[reqJson.data[1]][reqJson.data[0]] = reqJson.data[2];
            Deno.writeTextFileSync("canva.json", JSON.stringify(canva));

            users[index].lastPlaceTime = Date.now();
            Deno.writeTextFileSync("users.json", JSON.stringify(users));

            return socket.send(JSON.stringify({
              type: "place",
              res: true,
            }));
          } else if (index - 1 >= users.length) {
            socket.send(JSON.stringify({
              type: "place",
              res: false,
            }));
          }
        },
      );

      sockets.forEach((sck) => {
        sck.send(
          JSON.stringify({
            type: "getCanvaData",
            res: JSON.parse(Deno.readTextFileSync("canva.json")),
          }),
        );
      });
    }
  };
  socket.onerror = (e) => {
    createLog("Socket errored: " + e.type, remoteAddr);
  };
  socket.onclose = () => {
    createLog("Socket disconnected.", remoteAddr);

    sockets.splice(sockets.indexOf(socket), 1);
  };
  return response;
}

const server = Deno.listen({ port: 1309 });

for await (const conn of server) {
  handle(conn);
}
