// Setup

// Modify the diameter to expand/contract space between nodes.
var diameter = 960;

var tree = d3.layout.tree()
    .size([360, diameter / 2 - 120])
    .separation(function(a, b) { return (a.parent == b.parent ? 1 : 2) / a.depth; });

var diagonal = d3.svg.diagonal.radial()
    .projection(function(d) { return [d.y, d.x / 180 * Math.PI]; });

var svg = d3.select("body").append("svg")
    .attr("width", diameter)
    .attr("height", diameter - 150)
  .append("g")
    .attr("transform", "translate(" + diameter / 2 + "," + (diameter / 2 - 100) + ")");

var tooltip = d3.select("body")
    .append("div")
    .style("position", "absolute")
    .style("background-color", "white")
    .style("border", "1px solid #ddd")
    .style("font", "9px monospace")
    .style("padding", "4px 2px")
    .style("z-index", "10")
    .style("visibility", "hidden");

// Global for now so we can play with it from the console
labelSet = {"service":"mysql"};

// Click handler for input labelSet
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

// Compare set of matchers to labelSet
function matchLabels(matchers, labelSet) {
  for (var j = 0; j < matchers.length; j++) {
    if (!matchLabel(matchers[j], labelSet)) {
      return false;
    }
  }
  return true;
}

// Compare single matcher to labelSet
function matchLabel(matcher, labelSet) {
  var v = labelSet[matcher.name];

  if (matcher.isRegex) {
    return matcher.value.test(v)
  }

  return matcher.value === v;
}

// Load config.json, the json version of an AlertManager config.yml
d3.json("config.json", function(error, graph) {
  // TODO: Current MarshalJSON is returning an {} for regex, get it to return a
  // stringified form.
  if (error) throw error;

  root = graph.data.Route;

  root.parent = null;
  massage(root)

  update(root);
});

// Translate AlertManager names to expected d3 tree names, convert AlertManager
// Match and MatchRE objects to js objects.
function massage(root) {
  if (!root) return;

  root.children = root.Routes

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

// Update the tree based on root.
function update(root) {
  var i = 0;
  var nodes = tree.nodes(root);
  var links = tree.links(nodes);

  var link = svg.selectAll(".link")
      .data(links)
    .enter().append("path")
      .attr("class", "link")
      .attr("d", diagonal);

  var node = svg.selectAll(".node")
      .data(nodes, function(d) { return d.id || (d.id = ++i); });

  var nodeEnter = node.enter().append("g")
    .attr("class", "node")
    .attr("transform", function(d) {
      return "rotate(" + (d.x - 90) + ")translate(" + d.y + ")";
    })

  nodeEnter.append("circle")
      .attr("r", 4.5);

  nodeEnter.append("text")
      .attr("dy", ".31em")
      .attr("text-anchor", function(d) { return d.x < 180 ? "start" : "end"; })
      .attr("transform", function(d) { return d.x < 180 ? "translate(8)" : "rotate(180)translate(-8)"; })
      .text(function(d) { return d.Receiver; });

  node.select(".node circle").style("fill", function(d) {
    return d.matched ? "steelblue" : "#fff";
  })
  .on("mouseover", function(d) {
    d3.select(this).style("fill", "steelblue");

    text = formatMatcherText(d.matchers);
    text.forEach(function(t) {
      tooltip.append("div").text(t);
    });
    if (text.length) {
      return tooltip.style("visibility", "visible");
    }
  })
  .on("mousemove", function() {
    return tooltip.style("top", (d3.event.pageY-10)+"px").style("left",(d3.event.pageX+10)+"px");
  })
  .on("mouseout", function(d) {
    d3.select(this).style("fill", d.matched ? "steelblue" : "#fff");
    tooltip.text("");
    return tooltip.style("visibility", "hidden");
  });
}

function formatMatcherText(matchersArray) {
  return matchersArray.map(function(m) {
    return m.name + ": " + m.value;
  });
}
