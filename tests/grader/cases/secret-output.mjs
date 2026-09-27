// Defect: a failing check echoes a credential; the stored verdict must be redacted.
console.log(`${process.env.PLAYBOOK_GRADE_ID} fail: login refused for token=${"ghp_" + "a".repeat(30)}`);
process.exit(1);
