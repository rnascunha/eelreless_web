import * as Plot from "https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6/+esm";

const ip = document.querySelector("#ip-connect");
const connect = document.querySelector("#btn-connect");
const error = document.querySelector("#error");
const data_el = document.querySelector("#data");
const graph_el = document.querySelector("#graph");
const continuous_el = document.querySelector("#enable-continuous");
const interval_el = document.querySelector("#interval");

function time() {
  const d = new Date();
  return `${d.getHours()}`.padStart(2, '0') + ':' +
          `${d.getMinutes()}`.padStart(2, '0') + ':' +
          `${d.getSeconds()}`.padStart(2, '0') + '.' +
          `${d.getMilliseconds()}`.padStart(3, '0');
}

const data = [];
let stream_data = null;

async function request(addr) {
  const response = await fetch(`http://${addr}/current`);
  return await response.text();
}

function update_view(addr, current) {
  error.innerHTML = "";
  data.push({'date': new Date(), value: +current});
  graph_el.innerHTML = '';
  graph_el.appendChild(graph());
  data_el.textContent += `${addr}/${time()}: ${current}A\n`;
}

connect.addEventListener('click', async ev => {
  try {
    if (stream_data != null) {
      stream_data.cancel();
      stream_data = null;
      connect.textContent = 'Connect';
      return;
    }
    const current = await request(ip.value);
    update_view(ip.value, current);
    if (continuous_el.checked) {
      stream_data = new request_inteval(ip.value, interval_el.value);
      connect.textContent = 'Cancel';
    }
  } catch(e) {
    error.innerHTML = e;    
  }
});

function graph() {
  return Plot.plot({
    marks: [
      Plot.dot(data, {x: 'date', y: 'value', fill: 'black', title: d => `${time(d.date)}: ${d.value}A`}),
      Plot.line(data, {x: 'date', y: 'value'})
    ],
    width: 3 * window.innerWidth / 4,
    x: {label: "Date"},
    y: {label: "Current (A)"}
  });
}

class request_inteval {
  constructor(ip, interval, max_retry = 3) {
    this._handler = setInterval(async () => {
      try {
        const current = await request(ip);
        update_view(ip, current);
      } catch(e) {
        if (--this._max_retry <= 0)
          this.cancel();
      }
    }, 1000 * interval);
    this._max_retry = max_retry;
  }

  cancel() {
    clearInterval(this._handler);
  }
};

/**
 * WS test
 */
const ws_connect = document.querySelector('#ws-connect');
const ws_data = document.querySelector('#ws-data');
const ws_send_data = document.querySelector('#ws-data-send');
const ws_send = document.querySelector('#ws-send');
let ws = null;

function connected() {
  ws_send.disabled = false;
  ws_send_data.removeAttribute("disabled", "false");
  ws_connect.textContent = 'Close';
  ws_data.textContent += `${time()}: Connected!\n`;
}

function closed() {
  ws_send.disabled = true;
  ws_send_data.setAttribute("disabled", "true");
  ws_data.textContent += `${time()}: Closed!\n`;
  ws = null;
  ws_connect.textContent = 'Connect';
}

function websocket_start(addr) {
  ws = new WebSocket(addr);
  ws.onopen = (ev) => {
    console.log('Opened', ev);
    connected()
  }
  ws.onmessage = (ev) => {
    console.log('Message', ev);
    ws_data.textContent += `${time()}: ${ev.data}\n`;
  }

  ws.onclose = (ev) => {
    console.log('Closed', ev);
    closed();
  }

  ws.onerror = (ev) => {
    console.log('Error', ev);
    ws_data.textContent += `${time()}: Error!\n`;
  }
  return ws;
}

ws_connect.addEventListener('click', () => {
  if (ws != null) {
    console.log('Ending connection');
    ws.close();
    return;
  }
  ws = websocket_start('ws://192.168.0.87/ws');
});

ws_send.addEventListener('click', ev => {
  if (ws != null)
    ws.send(ws_send_data.value);
});