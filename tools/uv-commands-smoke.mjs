const { configureUvCommands, renderCompareNets, renderNetTo } = await import('../engine/core/uv-commands.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const calls = [];
configureUvCommands({
  overlayRuntime: {
    renderUvNetToCanvas: (canvas, mode) => calls.push(['net', canvas, mode]),
    renderUvCompareNets: () => calls.push(['compare']),
  },
});
renderNetTo('canvas', 'box');
renderCompareNets();
assert(JSON.stringify(calls) === JSON.stringify([['net', 'canvas', 'box'], ['compare']]), 'UV commands did not invoke the injected overlay runtime');
configureUvCommands();
renderNetTo('ignored', 'planar');
assert(calls.length === 2, 'UV commands should tolerate an absent overlay runtime');
console.log('uv-commands: PASS');
