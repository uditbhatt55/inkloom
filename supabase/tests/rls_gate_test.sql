-- Gate hardening tests (decision D1). Always ends by raising, so everything is rolled back.
-- Pass: ERROR "ALL <n> GATE TESTS PASSED". Run after rls_test.sql.
do $$
declare
  a uuid := gen_random_uuid(); u_rev uuid := gen_random_uuid(); u_cre uuid := gen_random_uuid();
  it uuid := gen_random_uuid(); v uuid := gen_random_uuid(); r uuid := gen_random_uuid(); f uuid := gen_random_uuid();
  n int; passed int := 0; ok boolean;
begin
  insert into auth.users (id, email) values (u_rev,'rev@g.test'),(u_cre,'cre@g.test');
  insert into organizations (id, name) values (a,'Org G');
  insert into memberships values (a,u_rev,'reviewer'),(a,u_cre,'creator');
  insert into content_items (id, org_id, title, owner_id) values (it,a,'Post',u_cre);
  insert into content_versions (id, org_id, item_id, n, text, sha256, created_by) values (v,a,it,1,'t','x',u_cre);
  insert into audit_runs (id, org_id, version_id, mode, score) values (r,a,v,'simulated',75);
  insert into findings (id, org_id, run_id, category, severity, confidence, quote, explanation)
    values (f,a,r,'claim','critical','high','q','e');

  -- creator rejects the fix (allowed) ...
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims', json_build_object('sub',u_cre,'role','authenticated')::text, true);
  update findings set status='rejected', reason='Marketing wants this wording' where id=f;
  select count(*) into n from findings where id=f and status='rejected';
  if n <> 1 then raise exception 'FAIL creator could not reject a fix'; end if;
  passed := passed + 1;

  -- ... but cannot clear it themselves
  ok := false;
  begin update findings set status='waived' where id=f; exception when others then ok := true; end;
  if not ok then raise exception 'FAIL creator waived own finding'; end if;
  ok := false;
  begin update findings set status='dismissed' where id=f; exception when others then ok := true; end;
  if not ok then raise exception 'FAIL creator dismissed own finding'; end if;
  ok := false;
  begin update findings set status='resolved' where id=f; exception when others then ok := true; end;
  if not ok then raise exception 'FAIL creator resolved own finding'; end if;
  passed := passed + 3;

  -- reviewer: approval still blocked after the creator's rejection
  perform set_config('request.jwt.claims', json_build_object('sub',u_rev,'role','authenticated')::text, true);
  ok := false;
  begin insert into decisions (org_id,item_id,version_id,decision,author_id) values (a,it,v,'approve',u_rev);
  exception when others then ok := sqlerrm like 'approval blocked%'; end;
  if not ok then raise exception 'FAIL gate: approve after creator rejection was not blocked'; end if;
  passed := passed + 1;

  -- reviewer may dismiss; approval then goes through
  update findings set status='dismissed' where id=f;
  select count(*) into n from findings where id=f and status='dismissed';
  if n <> 1 then raise exception 'FAIL reviewer could not dismiss'; end if;
  insert into decisions (org_id,item_id,version_id,decision,author_id) values (a,it,v,'approve',u_rev);
  select count(*) into n from content_items where id=it and status='approved';
  if n <> 1 then raise exception 'FAIL approve after dismiss did not set status'; end if;
  passed := passed + 2;

  raise exception 'ALL % GATE TESTS PASSED', passed;
end $$;
