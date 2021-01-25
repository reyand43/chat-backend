const { notDeepStrictEqual } = require("assert");
const { error } = require("console");
const { response } = require("express");
const express = require("express");
const { SUCCESS, ERROR } = require("./constants");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const rooms = new Map();
const users = new Map();
const videoUsers = {};
const socketToRoom = {};

io.on("connection", (socket) => {
  socket.join("rooms");

  socket.on("add user", (userName, callback) => {
    if (users.has(userName)) {
      callback(ERROR("Such user already exist"));
    } else {
      users.set(userName, socket.id);
      socket.userName = userName;
      callback(SUCCESS("User added"));
      socket.emit("room added", {
        rooms: [...rooms.keys()],
      });
    }
  });

  socket.on("add room", (roomName) => {
    if (!rooms.has(roomName)) {
      rooms.set(
        roomName,
        new Map([
          ["users", new Map()],
          ["messages", []],
        ])
      );
    }
    io.to("rooms").emit("room added", {
      rooms: [...rooms.keys()],
    });
  });

  socket.on("join room", ({ roomName, userName }, callback) => {
    if (rooms.has(roomName)) {
      socket.join(`room ${roomName}`);
      // rooms.get(roomName).get("users").set({userName, id: socket.id});
      rooms.get(roomName).get("users").set(socket.id, userName);
      callback(SUCCESS("Success join"));
      io.to(`room ${roomName}`).emit("user added to room", {
        users: [...rooms.get(roomName).get("users").values()],
      });
      socket.emit("message list", {
        messages: [...rooms.get(roomName).get("messages")],
      });
    } else {
      callback(ERROR("No such room"));
    }
  });

  socket.on("change room", ({ prevRoom, nextRoom, userName }, callback) => {
    socket.leave(`room ${prevRoom}`);
    socket.join(`room ${nextRoom}`);
    roomName = nextRoom;
    rooms.get(prevRoom).get("users").delete(socket.id);
    rooms.get(roomName).get("users").set(socket.id, userName);
    callback(SUCCESS("Success room change"));
    io.to(`room ${prevRoom}`).emit("user added to room", {
      users: [...rooms.get(prevRoom).get("users").values()],
    });
    io.to(`room ${roomName}`).emit("user added to room", {
      users: [...rooms.get(roomName).get("users").values()],
    });
    socket.emit("message list", {
      messages: [...rooms.get(roomName).get("messages")],
    });
  });

  socket.on(
    "add message",
    ({ roomName, text, userName, timestamp }, callback) => {
      const messageInfo = {
        text,
        userName,
        timestamp,
      };
      rooms.get(roomName).get("messages").push(messageInfo);
      callback(SUCCESS("Message added"));
      socket.broadcast.to(`room ${roomName}`).emit("message list", {
        messages: [...rooms.get(roomName).get("messages")],
      });
    }
  );

  socket.on("sending signal", (payload) => {
    io.to(payload.userToSignal).emit("user joined", {
      signal: payload.signal,
      callerID: payload.callerID,
    });
  });

  socket.on("returning signal", (payload) => {
    io.to(payload.callerID).emit("receiving returned signal", {
      signal: payload.signal,
      id: socket.id,
    });
  });

  socket.on("join video room", (roomID) => {
    if (videoUsers[roomID]) {
      const length = videoUsers[roomID].length;
      if (length === 4) {
        socket.emit("room full");
        return;
      }
      videoUsers[roomID].push(socket.id);
    } else {
      videoUsers[roomID] = [socket.id];
    }
    socketToRoom[socket.id] = roomID;
    const usersInThisRoom = videoUsers[roomID].filter((id) => id !== socket.id);

    socket.emit("all users", usersInThisRoom);
  });

  socket.on("disconnect", () => {
    rooms.forEach((room, roomName) => {
      if (room.get("users").delete(socket.id)) {
        socket.to(`room ${roomName}`).broadcast.emit("user added to room", {
          users: [...rooms.get(roomName).get("users").values()],
        });
      }
    });

    const roomID = socketToRoom[socket.id];
    let room = users[roomID];
    if (room) {
      room = room.filter((id) => id !== socket.id);
      videoUsers[roomID] = room;
    }
  });
});

server.listen(8000, (error) => {
  if (error) {
    throw Error(err);
  }
  console.log("server started");
});
