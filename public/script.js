var margin = {top: 20, right: 120, bottom: 20, left: 120};
var width = 960 - margin.right - margin.left;
var height = 500 - margin.top - margin.bottom;

var tree = d3.layout.tree()
  .size([height, width]);

var diagonal = d3.svg.diagonal()
  .projection(function(d) { return [d.y, d.x]; });

var svg = d3.select("body").append("svg")
  .attr("width", width + margin.right + margin.left)
  .attr("height", height + margin.top + margin.bottom)
  .append("g")
  .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

// Global for now so we can play with it from the console
labelSet = {"service":"foo1"};
d3.select(".js-find-match").on("click", function() {
  var searchValue = document.querySelector("input").value
  // this needs to be an object of key-value pairs
  // var labelSet = {"service":"files", "severity":"critical"};
  var matches = match(root, labelSet)
  var nodes = tree.nodes(root);
  var idx = nodes.map(function(n) { return n.id }).indexOf(matches[0].id)
  nodes.forEach(function(n) { n.matched = false });
  nodes[idx].matched = true;
  update(root);
  // highlight the node that matches, maybe animate way through if possible
});

// Match does a depth-first left-to-right search through the route tree
// and returns the matching routing nodes.
function match(root, labelSet) {
  // See if the node is a match. If it is, recurse through the children.
  if (!matchLabels(root.matchers, labelSet)) {
    return [];
  }

  var all = []

  if (root.children) {
    for (var j = 0; j < root.children.length; j++) {
      child = root.children[j];
      matches = match(child, labelSet)

      all = all.concat(matches);

      if (matches && !child.Continue) {
        break;
      }
    }
  }

  // If no child nodes were matches, the current node itself is a match.
  if (all.length === 0) {
    all.push(root);
  }

  return all
}

function matchLabels(matchers, labelSet) {
  for (var j = 0; j < matchers.length; j++) {
    if (!matchLabel(matchers[j], labelSet)) {
      return false;
    }
  }
  return true;
}

function matchLabel(matcher, labelSet) {
  var v = labelSet[matcher.name];

  if (matcher.isRegex) {
    return matcher.value.test(v)
  }

  return matcher.value === v;
}

d3.json("config.json", function(error, graph) {
  // TODO: Current MarshalJSON is returning an {} for regex, get it to return a
  // stringified form.
  if (error) throw error;

  root = graph.data.Route;

  root.parent = null;
  massage(root)

  update(root);
});

function massage(root) {
  if (!root) return;

  root.children = root.Routes

  // add match and matchregex as objects, set matchregex.isRegex = true
  var matchers = []
  if (root.Match) {
    for (var key in root.Match) {
      var o = {};
      o.isRegex = false;
      o.value = root.Match[key];
      o.name = key;
      matchers.push(o);
    }
  }

  if (root.MatchRE) {
    for (var key in root.MatchRE) {
      var o = {};
      o.isRegex = true;
      o.value = new RegExp(root.MatchRE[key]);
      o.name = key;
      matchers.push(o);
    }
  }

  root.matchers = matchers;

  if (!root.children) return;

  root.children.forEach(function(child) {
    child.parent = root;
    massage(child)
  });
}

function update(root) {
  var i = 0
  // Compute the new tree layout.
  var nodes = tree.nodes(root).reverse(),
    links = tree.links(nodes);

    // Normalize for fixed-depth.
    nodes.forEach(function(d) { d.y = d.depth * 180; });

    // Declare the nodes.
    var node = svg.selectAll("g.node")
    .data(nodes, function(d) { return d.id || (d.id = ++i); });

    // Enter the nodes.
    var nodeEnter = node.enter().append("g")
      .attr("class", "node")
      .attr("transform", function(d) {
        return "translate(" + d.y + "," + d.x + ")";
      });

    nodeEnter.append("circle").attr("r", 10);

    node.select("circle").style("fill", function(d) {
      return d.matched ? "yellow" : "steelblue";
    });

    nodeEnter.append("text")
      .attr("x", function(d) {
        return d.children || d._children ? -13 : 13;
      })
      .attr("dy", ".35em")
      .attr("text-anchor", function(d) {
        return d.children || d._children ? "end" : "start";
      })
      .text(function(d) {
        return d.Receiver;
      })
      .style("fill", "red")
      .style("fill-opacity", 1);

    // Declare the links.
    var link = svg.selectAll("path.link")
      .data(links, function(d) { return d.target.id; });

    // Enter the links.
    link.enter().insert("path", "g")
      .attr("class", "link")
      .attr("d", diagonal);
}
