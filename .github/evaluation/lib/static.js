'use strict';

const fs = require('node:fs');
const path = require('node:path');
const acorn = require('acorn');
const walk = require('acorn-walk');
const { SCRIPTS } = require('./projet');

const ARRAY_METHODS = ['find', 'filter', 'map', 'some', 'sort', 'reduce'];
const CALLBACK_METHODS = [...ARRAY_METHODS, 'findIndex', 'every', 'forEach', 'flatMap'];
const HTML_SINKS = ['innerHTML', 'outerHTML'];
const DOM_GLOBALS = ['document', 'window', 'localStorage', 'sessionStorage', 'alert', 'confirm', 'prompt'];

const isFunctionNode = (n) => n && ['ArrowFunctionExpression', 'FunctionExpression', 'FunctionDeclaration'].includes(n.type);
const isStringNode = (n) => (n.type === 'Literal' && typeof n.value === 'string') || n.type === 'TemplateLiteral';
// Une chaîne « sûre » pour innerHTML : littéral sans expression (ex. vider un conteneur avec '').
const isConstantString = (n) => (n.type === 'Literal' && typeof n.value === 'string') || (n.type === 'TemplateLiteral' && n.expressions.length === 0);

const parse = (code) => {
  const options = { ecmaVersion: 'latest', locations: true, allowHashBang: true };
  try {
    return { ast: acorn.parse(code, { ...options, sourceType: 'script' }) };
  } catch (e) {
    try {
      return { ast: acorn.parse(code, { ...options, sourceType: 'module' }) };
    } catch {
      return { error: `SyntaxError : ${e.message.replace(/\s*\(\d+:\d+\)$/, '')} (ligne ${e.loc ? e.loc.line : '?'})` };
    }
  }
};

const returnsSomething = (fn) => {
  if (fn.type === 'ArrowFunctionExpression' && fn.body.type !== 'BlockStatement') return true;
  let found = false;
  walk.recursive(fn.body, null, {
    ReturnStatement: () => {
      found = true;
    },
    // Les fonctions imbriquées ont leurs propres return.
    FunctionDeclaration: () => {},
    FunctionExpression: () => {},
    ArrowFunctionExpression: () => {},
  });
  return found;
};

const analyzeFile = (file, code) => {
  const parsed = parse(code);
  const facts = {
    file,
    lines: code.split('\n').length,
    syntaxError: parsed.error || null,
    varCount: 0,
    looseEq: [],
    classicFunctions: [],
    concat: [],
    templates: 0,
    arrows: 0,
    arrayMethods: new Set(),
    callbacksWithoutReturn: [],
    htmlSinks: [],
    createElement: 0,
    textContent: 0,
    domGlobals: new Set(),
    listeners: new Set(),
    preventDefault: 0,
    delegation: 0,
    fetch: 0,
    localStorage: 0,
    topLevel: new Set(),
    letNeverReassigned: [],
  };
  if (!parsed.ast) return facts;
  const ast = parsed.ast;

  ast.body.forEach((node) => {
    if (node.type === 'VariableDeclaration') node.declarations.forEach((d) => d.id.type === 'Identifier' && facts.topLevel.add(d.id.name));
    if (node.type === 'FunctionDeclaration' && node.id) facts.topLevel.add(node.id.name);
  });

  const lets = new Map();
  const assigned = new Set();

  walk.fullAncestor(ast, (node, state, ancestors) => {
    switch (node.type) {
      case 'VariableDeclaration':
        if (node.kind === 'var') facts.varCount += 1;
        if (node.kind === 'let') {
          const parent = ancestors[ancestors.length - 2];
          const inForInit = parent && ['ForStatement', 'ForOfStatement', 'ForInStatement'].includes(parent.type);
          node.declarations.forEach((d) => {
            if (d.id.type === 'Identifier' && d.init && !inForInit) lets.set(d.id.name, d.loc.start.line);
          });
        }
        break;
      case 'AssignmentExpression':
        if (node.left.type === 'Identifier') assigned.add(node.left.name);
        if (node.left.type === 'MemberExpression' && !node.left.computed && node.left.property.type === 'Identifier') {
          const prop = node.left.property.name;
          if (HTML_SINKS.includes(prop)) facts.htmlSinks.push({ line: node.loc.start.line, prop, constant: isConstantString(node.right) });
          if (prop === 'textContent' || prop === 'innerText') facts.textContent += 1;
        }
        break;
      case 'UpdateExpression':
        if (node.argument.type === 'Identifier') assigned.add(node.argument.name);
        break;
      case 'BinaryExpression':
        if (node.operator === '==' || node.operator === '!=') facts.looseEq.push({ op: node.operator, line: node.loc.start.line });
        if (node.operator === '+' && (isStringNode(node.left) || isStringNode(node.right)) && !(isStringNode(node.left) && isStringNode(node.right))) {
          facts.concat.push({ line: node.loc.start.line });
        }
        break;
      case 'TemplateLiteral':
        if (node.expressions.length > 0) facts.templates += 1;
        break;
      case 'ArrowFunctionExpression':
        facts.arrows += 1;
        break;
      case 'FunctionDeclaration':
      case 'FunctionExpression': {
        const parent = ancestors[ancestors.length - 2];
        // Les méthodes d'objet ({ toString() {} }) et de classe restent tolérées.
        if (!(parent && (parent.type === 'MethodDefinition' || (parent.type === 'Property' && parent.method)))) {
          facts.classicFunctions.push({ name: node.id ? node.id.name : '(anonyme)', line: node.loc.start.line });
        }
        break;
      }
      case 'Identifier':
        if (DOM_GLOBALS.includes(node.name)) {
          const parent = ancestors[ancestors.length - 2];
          const isProperty = parent && parent.type === 'MemberExpression' && parent.property === node && !parent.computed;
          const isKey = parent && parent.type === 'Property' && parent.key === node && !parent.computed;
          if (!isProperty && !isKey) facts.domGlobals.add(node.name);
        }
        if (node.name === 'localStorage') facts.localStorage += 1;
        if (node.name === 'fetch') facts.fetch += 1;
        break;
      case 'CallExpression': {
        const callee = node.callee;
        if (callee.type === 'Identifier' && callee.name === 'fetch') facts.fetch += 1;
        if (callee.type !== 'MemberExpression' || callee.computed || callee.property.type !== 'Identifier') break;
        const method = callee.property.name;
        if (ARRAY_METHODS.includes(method)) facts.arrayMethods.add(method);
        if (CALLBACK_METHODS.includes(method) && method !== 'forEach' && isFunctionNode(node.arguments[0]) && !returnsSomething(node.arguments[0])) {
          facts.callbacksWithoutReturn.push({ method, line: node.loc.start.line });
        }
        if (method === 'createElement') facts.createElement += 1;
        if (method === 'insertAdjacentHTML' || (method === 'write' && callee.object.type === 'Identifier' && callee.object.name === 'document')) {
          const arg = node.arguments[node.arguments.length - 1];
          facts.htmlSinks.push({ line: node.loc.start.line, prop: method, constant: Boolean(arg) && isConstantString(arg) });
        }
        if (method === 'addEventListener' && node.arguments[0] && node.arguments[0].type === 'Literal') facts.listeners.add(node.arguments[0].value);
        if (method === 'preventDefault') facts.preventDefault += 1;
        if (method === 'closest' || method === 'matches') facts.delegation += 1;
        break;
      }
      case 'MemberExpression':
        // event.target.dataset… : lecture de l'élément cliqué dans un écouteur délégué.
        if (!node.computed && node.property.name === 'dataset' && node.object.type === 'MemberExpression' && node.object.property.name === 'target') facts.delegation += 1;
        break;
      default:
        break;
    }
  });

  facts.letNeverReassigned = [...lets.entries()].filter(([name]) => !assigned.has(name)).map(([name, line]) => ({ name, line }));
  return facts;
};

// Analyse les 4 fichiers JS du contrat (et les autres .js de js/ s'il y en a).
const analyzeProject = (root) => {
  const dir = path.join(root, 'js');
  const extra = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => `js/${f}`).filter((f) => !SCRIPTS.includes(f))
    : [];
  const files = [...SCRIPTS, ...extra]
    .filter((f) => fs.existsSync(path.join(root, f)))
    .map((f) => analyzeFile(f, fs.readFileSync(path.join(root, f), 'utf8')));
  const byFile = new Map(files.map((f) => [f.file, f]));
  const all = (key) => files.flatMap((f) => f[key].map((x) => ({ ...x, file: f.file })));
  const sum = (key) => files.reduce((total, f) => total + f[key], 0);
  return {
    files,
    byFile,
    syntaxErrors: files.filter((f) => f.syntaxError).map((f) => `${f.file} : ${f.syntaxError}`),
    varCount: sum('varCount'),
    looseEq: all('looseEq'),
    classicFunctions: all('classicFunctions'),
    concat: all('concat'),
    templates: sum('templates'),
    arrayMethods: new Set(files.flatMap((f) => [...f.arrayMethods])),
    callbacksWithoutReturn: all('callbacksWithoutReturn'),
    htmlSinks: all('htmlSinks'),
    createElement: sum('createElement'),
    textContent: sum('textContent'),
    listeners: new Set(files.flatMap((f) => [...f.listeners])),
    preventDefault: sum('preventDefault'),
    delegation: sum('delegation'),
    fetch: sum('fetch'),
    letNeverReassigned: all('letNeverReassigned'),
    localStorageOutside: files.filter((f) => f.file !== 'js/stockage.js' && f.localStorage > 0).map((f) => f.file),
    donneesDom: byFile.has('js/donnees.js') ? [...byFile.get('js/donnees.js').domGlobals] : [],
  };
};

module.exports = { analyzeProject, analyzeFile, ARRAY_METHODS };
