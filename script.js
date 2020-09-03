const maxN = 1000;
const margin = ({top: 20, right: 20, bottom: 25, left: 20})
const height = 500;

const inputStart = document.getElementById("startN")
const inputStartR = document.getElementById("startNR")
const inputEnd = document.getElementById("endN")
const inputEndR = document.getElementById("endNR")

let startN = inputStart.valueAsNumber, endN = inputEnd.valueAsNumber;

{
  let countN = endN - startN
  
  function setStart(start){
  	inputStart.value = start;
    inputStartR.value = start;
	startN = start;
    // can't mark dirty because it might redraw immediately (why?)
	// every setStart must be followed by setEnd to maintain dirty flag
  }
  
  function setEnd(end){
  	inputEnd.value = end;
    inputEndR.value = end;
	endN = end;
    markDirty();
  }
  
  function updateStart(){
    let start = this.valueAsNumber
    if(start>0 && start<=maxN){ // handles NaN
      setStart(start);
      let end = start + countN;
      if(end > maxN) end = maxN;
      setEnd(end);
    }
  }
  
  function updateEnd(){
    let end = this.valueAsNumber;
    if(end >= 1 && end <= maxN){
      if(end < startN)
        end = startN;
      setEnd(end);
      countN = end - startN;
    }
  }
  
  inputStart.addEventListener("input", updateStart);
  inputStartR.addEventListener("input", updateStart);
  inputEnd.addEventListener("input", updateEnd);
  inputEndR.addEventListener("input", updateEnd);
  
  function updateStartEnd(start, end){
	setStart(start);
    setEnd(end);
    countN = end - start;
  }
}

let dirty = false;

function markDirty(){
	if(!dirty){
		dirty = true
		new Promise(redraw)
	}
}

let pStartN = -1, pEndN = -1;

let dataRaw = null; // this hurts me, I suppose mutating markDirty instead wouldn't be so bad

d3.csv('onecosts.csv', ({N: n, cost: cost, operator: op, arg1: a1, arg2: a2}) => ({y: +cost, a1: +a1, op, a2: +a2, x: +n}))
  .then(d => {dataRaw = d; markDirty()})

const graphDiv = document.getElementById('graph')

function redraw(){
	if(startN == pStartN && endN == pEndN){
		dirty = false;
		return;
	}
	
	pStartN = startN;
	pEndN = endN;
	
	const data = dataRaw.slice(startN-1, endN).map(d => Object.assign({y1: d.y - dataRaw[d.a2-1].y}, d))
	const width = window.innerWidth;
	const color = d3.scaleOrdinal("=+*^-/".split(''), d3.schemeDark2)
	const shape = d3.scaleOrdinal(".+^/*-=".split(''), d3.symbols.map(s => d3.symbol().type(s).size(24)()))
	
	const ymax = 1+d3.max(data, d => d.y) // +1 for extra empty space
	
	if (!data[0] || !data[data.length-1])
        console.log(data);
	
	const x = d3.scaleLinear().domain([Math.max(1, startN-1), endN+1])
                .range([margin.left, width - margin.right])
				
    const y = d3.scaleLinear().domain([1, ymax])
	            .range([height - margin.bottom, margin.top])
				
	const xAxis = g => g
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(width / 40))
    .call(g => g.select(".domain").remove())
    .call(g => g.append("text")
        .attr("x", width/2)
        .attr("y", margin.bottom)
        .attr("fill", "currentColor")
        .attr("text-anchor", "end")
        .text('N'))
		
    const yAxis = g => g
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y).ticks(ymax))
        .call(g => g.select(".domain").remove())
        .call(g => g.append("text")
            .attr("x", -margin.left)
            .attr("y", 10)
            .attr("fill", "currentColor")
            .attr("text-anchor", "start")
            .text("Cost in 1's"))
	
	const grid = g => g
        .attr("stroke", "currentColor")
        .attr("stroke-opacity", 0.1)
        .call(g => g.append("g")
          .selectAll("line")
          .data(x.ticks(width/40))
          .join("line")
            .attr("x1", d => 0.5 + x(d))
            .attr("x2", d => 0.5 + x(d))
            .attr("y1", margin.top)
            .attr("y2", height - margin.bottom))
        .call(g => g.append("g")
          .selectAll("line")
          .data(y.ticks(ymax))
          .join("line")
            .attr("y1", d => 0.5 + y(d))
            .attr("y2", d => 0.5 + y(d))
            .attr("x1", margin.left)
            .attr("x2", width - margin.right));
	
	const toSvg = txt => new DOMParser().parseFromString(txt, "image/svg+xml");
	
	class Tooltip {
      constructor() {
		  // It took over an hour to find that the reason my tooltip was invisible was because you need this 'NS' method
		  const create = t => document.createElementNS('http://www.w3.org/2000/svg', t);
		  const _N = create('text')
		  _N.setAttribute('y', '-22')
		  
		  const _Y = create('text')
		  _Y.setAttribute('y', '-12')
		  
		  // Temp Wrapper to avoid 5 setAttribute calls. Legacy name from my debug session.
		  const expletive = create('svg')
		  expletive.innerHTML = `<g pointer-events="none" display="none" font-family="sans-serif" font-size="10" text-anchor="middle">
		<rect x="-35" width="70" y="-30" height="20" fill="white"></rect>
		<circle r="2"></circle></g>`;
		  const node = expletive.firstChild;
		  
		  node.append(_N)
		  node.append(_Y)
		  
		  this._N = _N
          this._Y = _Y
          this.node = node;
      }
      show(N) {
        this.node.removeAttribute("display");
        const d = data[N - startN];
        const yVal = d.y;
        this.node.setAttribute("transform", `translate(${x(N)},${y(yVal)})`);
        this._N.textContent = `${N} = ${d.a1}${d.op}${d.a2}`;
        this._Y.textContent = `Cost: ${yVal}`;
      }
      hide() {
        this.node.setAttribute("display", "none");
      }
    }
	
	
	const svg = d3.create("svg").attr("viewBox", [0, 0, width, height]).attr("stroke-width", 1.5)
        .attr("font-size", 12);
		
    svg.append("g").call(xAxis);
    svg.append("g").call(yAxis);
    svg.append("g").call(grid);
    
    svg.append("g").selectAll("path")
      .data(data)
      .join("path")
        .attr("transform", d => `translate(${x(d.x)},${y(d.y)})`)
        .attr("fill", d => color(d.op))
        .attr("d", d => shape(d.op));
    
    svg.append("g").selectAll("line")
      .data(data)
      .join("line")
        .attr('stroke', d => color(d.op))
        .attr("x1", d => x(d.x))
        .attr("y1", d => y(d.y1))
        .attr("x2", d => x(d.x))
        .attr("y2", d => y(d.y));
    
    const tooltip = new Tooltip();
    
    let pN = -1, sX = -1;
    svg.on('mousemove', event => {
        const N = Math.round(x.invert(event.offsetX))
        if(N!=pN && N >= startN && N <= endN){
          tooltip.show(N);
        }
        pN = N;
    }).on('mouseout', () => {tooltip.hide(); pN = -1})
      .append(() => tooltip.node);
    
    svg.on('mousedown', event => {
        if(event.button==0) sX = event.offsetX;
    }).on('click', event => {
        if(event.button==0 && sX >= 0){
           const N1 = Math.round(x.invert(sX))
           const N2 = Math.round(x.invert(event.offsetX))
           if(N1 >= startN && N1 < N2 && N2 <= endN){
             updateStartEnd(N1, N2);
           }
        }
    });
	
	graphDiv.replaceChild(svg.node(), graphDiv.firstChild)
	dirty=false;
}