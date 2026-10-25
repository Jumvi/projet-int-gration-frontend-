'use strict';

// Une vérification = { label, ok, hint } ; `hint` n'est affiché que si ok === false.
const check = (label, ok, hint) => ({ label, ok: Boolean(ok), hint: hint || label });

// Une vérification « non mesurable » (ex. réseau indisponible) : exclue des calculs.
const skip = (label, hint) => ({ label, ok: null, hint: hint || label });

const ratio = (checks) => {
  const counted = checks.filter((c) => c.ok !== null);
  return counted.length === 0 ? 0 : counted.filter((c) => c.ok).length / counted.length;
};

const failed = (checks) => checks.filter((c) => c.ok === false);

module.exports = { check, skip, ratio, failed };
