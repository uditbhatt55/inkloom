-- RLS + approval-gate tests (milestone M1, proposal §8.1, §10.1).
-- Runs as one DO block and ALWAYS ends by raising an exception, so every change is rolled back.
-- Pass:  ERROR "ALL <n> RLS TESTS PASSED"
-- Fail:  ERROR "FAIL <test name>: ..."
-- Run in the Supabase SQL editor or via the Supabase MCP execute_sql (as postgres).
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid();
  u_owner uuid := gen_random_uuid(); u_rev uuid := gen_random_uuid(); u_cre uuid := gen_random_uuid();
  u_agy uuid := gen_random_uuid(); u_view uuid := gen_random_uuid(); u_bown uuid := gen_random_uuid();
  item_cre uuid := gen_random_uuid(); item_agy uuid := gen_random_uuid(); item_rev uuid := gen_random_uuid();
  ver_cre uuid := gen_random_uuid(); ver_rev uuid := gen_random_uuid();
  run_cre uuid := gen_random_uuid(); f_crit uuid := gen_random_uuid();
  n int; passed int := 0; ok boolean;
begin
  -- ── fixtures (as postgres) ──
  insert into auth.users (id, email) values
    (u_owner,'owner@a.test'),(u_rev,'rev@a.test'),(u_cre,'cre@a.test'),
    (u_agy,'agy@a.test'),(u_view,'view@a.test'),(u_bown,'owner@b.test');
  insert into organizations (id, name) values (a,'Org A'),(b,'Org B');
  insert into memberships values (a,u_owner,'owner'),(a,u_rev,'reviewer'),(a,u_cre,'creator'),
    (a,u_agy,'agency'),(a,u_view,'viewer'),(b,u_bown,'owner');
  insert into approved_facts (org_id, code, statement, visibility) values
    (a,'FACT-07','Sync SLA: 99.9% monthly uptime','public'),(a,'FACT-90','Q3 internal target','internal');
  insert into terminology (org_id, code, term, kind) values
    (a,'TERM-01','Northbeam Sync','preferred'),(a,'TERM-31','Project Atlas','internal');
  insert into guideline_clauses (org_id, code, category, text) values (a,'CLAIM-02','claim','No "guaranteed".');
  insert into content_items (id, org_id, title, owner_id) values
    (item_cre,a,'Creator post',u_cre),(item_agy,a,'Agency post',u_agy),(item_rev,a,'Reviewer post',u_rev);
  insert into content_versions (id, org_id, item_id, n, text, sha256, created_by) values
    (ver_cre,a,item_cre,1,'Sync delivers 99.99% uptime, guaranteed.','x',u_cre),
    (ver_rev,a,item_rev,1,'Hello','y',u_rev);
  insert into audit_runs (id, org_id, version_id, mode, score) values (run_cre,a,ver_cre,'simulated',53);
  insert into findings (id, org_id, run_id, category, severity, confidence, quote, explanation) values
    (f_crit,a,run_cre,'claim','critical','high','99.99% uptime, guaranteed','Contradicts FACT-07');

  -- ── 1. org isolation: B owner sees nothing of A ──
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims', json_build_object('sub',u_bown,'role','authenticated')::text, true);
  select (select count(*) from approved_facts where org_id=a) + (select count(*) from guideline_clauses where org_id=a)
       + (select count(*) from content_items where org_id=a) + (select count(*) from organizations where id=a) into n;
  if n <> 0 then raise exception 'FAIL org isolation: B sees % rows of A', n; end if;
  passed := passed + 1;

  ok := false;
  begin insert into approved_facts (org_id, code, statement) values (a,'FACT-X','hack');
  exception when others then ok := true; end;
  if not ok then raise exception 'FAIL org isolation: B wrote a fact into A'; end if;
  passed := passed + 1;

  -- ── 2. creator: public facts/terms only, cannot edit knowledge, cannot decide ──
  perform set_config('request.jwt.claims', json_build_object('sub',u_cre,'role','authenticated')::text, true);
  select count(*) into n from approved_facts where org_id=a;
  if n <> 1 then raise exception 'FAIL creator facts: sees % (expected 1 public)', n; end if;
  select count(*) into n from terminology where org_id=a and kind='internal';
  if n <> 0 then raise exception 'FAIL creator terms: sees internal codename'; end if;
  passed := passed + 2;

  ok := false;
  begin insert into approved_facts (org_id, code, statement) values (a,'FACT-Y','x');
  exception when others then ok := true; end;
  if not ok then raise exception 'FAIL creator wrote a fact'; end if;
  passed := passed + 1;

  ok := false;
  begin insert into decisions (org_id,item_id,version_id,decision,author_id) values (a,item_cre,ver_cre,'approve',u_cre);
  exception when others then ok := true; end;
  if not ok then raise exception 'FAIL creator approved own work'; end if;
  passed := passed + 1;

  ok := false;
  begin update content_items set status='approved' where id=item_cre;
  exception when others then ok := true; end;
  if not ok then raise exception 'FAIL creator changed status directly'; end if;
  passed := passed + 1;

  -- ── 3. agency: only its own items ──
  perform set_config('request.jwt.claims', json_build_object('sub',u_agy,'role','authenticated')::text, true);
  select count(*) into n from content_items where org_id=a;
  if n <> 1 then raise exception 'FAIL agency sees % items (expected 1)', n; end if;
  select count(*) into n from findings where org_id=a;
  if n <> 0 then raise exception 'FAIL agency sees findings of other items'; end if;
  passed := passed + 2;

  -- ── 4. viewer: read-only ──
  perform set_config('request.jwt.claims', json_build_object('sub',u_view,'role','authenticated')::text, true);
  ok := false;
  begin insert into comments (org_id,item_id,author_id,body) values (a,item_cre,u_view,'hi');
  exception when others then ok := true; end;
  if not ok then raise exception 'FAIL viewer commented'; end if;
  passed := passed + 1;

  -- ── 5. reviewer: gate blocks approve while a critical is open ──
  perform set_config('request.jwt.claims', json_build_object('sub',u_rev,'role','authenticated')::text, true);
  select count(*) into n from approved_facts where org_id=a;
  if n <> 2 then raise exception 'FAIL reviewer should see internal facts, sees %', n; end if;
  passed := passed + 1;

  ok := false;
  begin insert into decisions (org_id,item_id,version_id,decision,author_id) values (a,item_cre,ver_cre,'approve',u_rev);
  exception when others then ok := sqlerrm like 'approval blocked%'; end;
  if not ok then raise exception 'FAIL gate: approve with open critical was not blocked'; end if;
  passed := passed + 1;

  ok := false;
  begin insert into decisions (org_id,item_id,version_id,finding_id,decision,author_id) values (a,item_cre,ver_cre,f_crit,'waive',u_rev);
  exception when check_violation then ok := true; end;
  if not ok then raise exception 'FAIL waive without reason was accepted'; end if;
  passed := passed + 1;

  insert into decisions (org_id,item_id,version_id,finding_id,decision,reason,author_id)
    values (a,item_cre,ver_cre,f_crit,'waive','Approved by Legal outside the system',u_rev);
  insert into decisions (org_id,item_id,version_id,decision,author_id) values (a,item_cre,ver_cre,'approve',u_rev);
  select count(*) into n from content_items where id=item_cre and status='approved';
  if n <> 1 then raise exception 'FAIL approve after waive did not set status'; end if;
  passed := passed + 1;

  ok := false;
  begin insert into decisions (org_id,item_id,version_id,decision,author_id) values (a,item_rev,ver_rev,'approve',u_rev);
  exception when others then ok := true; end;
  if not ok then raise exception 'FAIL reviewer approved own work'; end if;
  passed := passed + 1;

  -- ── 6. history is append-only ──
  select count(*) into n from activity_log where org_id=a and target_table='decisions';
  if n < 2 then raise exception 'FAIL activity_log missing decisions (%)', n; end if;
  ok := false;
  begin delete from activity_log where org_id=a;
  exception when others then ok := true; end;
  if not ok then raise exception 'FAIL activity_log delete allowed'; end if;
  ok := false;
  begin update content_versions set text='rewritten' where id=ver_cre;
  exception when others then ok := true; end;
  if not ok then raise exception 'FAIL version text was edited'; end if;
  passed := passed + 3;

  -- ── 7. anonymous sees nothing ──
  perform set_config('role','anon',true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  ok := false;
  begin select count(*) into n from approved_facts; ok := n = 0;
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL anon read facts'; end if;
  passed := passed + 1;

  raise exception 'ALL % RLS TESTS PASSED', passed;
end $$;
