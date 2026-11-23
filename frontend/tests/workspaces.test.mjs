import test from "node:test";
import assert from "node:assert/strict";
import { workspaceFor, renderWorkspaceDashboard, renderManagementCourses } from "../src/features/workspaces.js";

test("workspace selection never grants an unknown role the admin interface", () => {
  assert.equal(workspaceFor({role:"Admin"}).key,"admin");
  assert.equal(workspaceFor({role:"User"}).key,"student");
  assert.equal(workspaceFor({role:"Staff"}).key,"staff");
  assert.equal(workspaceFor({role:"Instructor"}).key,"instructor");
  assert.equal(workspaceFor({role:"administrator"}).key,"guest");
  assert.equal(workspaceFor(null).key,"guest");
});

test("management lists escape stored course content and honor editing permissions", () => {
  const courses=[{id:8,title:'<img src=x onerror=alert(1)>',categoryName:'<script>bad</script>',instructorName:'<svg onload=bad>',price:0}];
  const html=renderManagementCourses(courses);
  assert.ok(html.includes('&lt;img'));
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('data-action="edit-course"'));
  assert.ok(renderManagementCourses(courses,{canEdit:()=>true}).includes('data-action="edit-course"'));
});

test("the instructor workbench shows only assigned courses", () => {
  const html=renderWorkspaceDashboard({user:{id:10,role:"Instructor",fullName:"Teacher"},courses:[{id:1,instructorId:10,title:"Owned course"},{id:2,instructorId:20,title:"Other teacher private work"}],lessons:[],progress:[],enrollments:[],userCounts:{}}, {statsMarkup:"",date:()=>""});
  assert.ok(html.includes('Owned course'));
  assert.ok(!html.includes('Other teacher private work'));
  assert.ok(!html.includes('data-action="create-user"'));
});
