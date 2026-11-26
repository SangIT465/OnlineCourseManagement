import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ROLE_NAMES,
  hasPermission,
  canAccessPage,
  canManageCourse,
  canCreateCourse,
  canResetPassword,
  directoryRoles,
  canSupportEnrollment,
} from "../src/auth/permissions.js";

test("Admin, Staff, Instructor and User are active roles", () => {
  assert.deepEqual(Object.keys(ROLE_NAMES), ["Admin", "Staff", "Instructor", "User"]);
  assert.equal(canAccessPage({ role: "Instructor" }, "users"), false);
  assert.equal(canAccessPage({ role: "Student" }, "progress"), false);
});

test("only Admin can create/delete accounts, change roles or assign staff", () => {
  for (const permission of [
    "accounts.manage",
    "roles.manage",
    "staff.assign",
  ]) {
    assert.equal(hasPermission({ role: "Admin" }, permission), true);
    for (const role of ["Staff", "Instructor", "User"])
      assert.equal(hasPermission({ role }, permission), false);
  }
});

test("Staff can operate the catalog but cannot gain account administration", () => {
  assert.equal(canManageCourse({ role: "Staff" }, { staffId: 999 }), true);
  assert.equal(canAccessPage({ role: "Staff" }, "users"), true);
  assert.equal(canAccessPage({ role: "Staff" }, "enrollments"), true);
  assert.equal(canAccessPage({ role: "Staff" }, "progress"), false);
  assert.deepEqual(
    directoryRoles({ role: "Staff" }).map(([role]) => role),
    ["User"],
  );
});

test("only Admin and Staff support User enrollments and export reports", () => {
  for (const role of ["Admin", "Staff", "Instructor", "User", "Unknown"]) {
    const allowed = ["Admin", "Staff"].includes(role);
    assert.equal(canSupportEnrollment({ role }, { role: "User" }), allowed);
    assert.equal(hasPermission({ role }, "reports.export"), allowed);
    for (const target of ["Staff", "Instructor", "Admin"])
      assert.equal(canSupportEnrollment({ role }, { role: target }), false);
  }
});

test("User learns but cannot access management screens or modify catalog records", () => {
  assert.equal(canAccessPage({ role: "User" }, "progress"), true);
  assert.equal(canAccessPage({ role: "User" }, "my-courses"), true);
  for (const page of ["users", "enrollments"])
    assert.equal(canAccessPage({ role: "User" }, page), false);
  assert.equal(canManageCourse({ role: "User" }, {}), false);
});

test("Staff can reset only User passwords; Admin can reset all supported roles", () => {
  for (const role of ["Admin", "Staff", "Instructor", "User"]) {
    assert.equal(canResetPassword({ role: "Admin" }, { role }), true);
    assert.equal(
      canResetPassword({ role: "Staff" }, { role }),
      role === "User",
    );
    assert.equal(canResetPassword({ role: "User" }, { role }), false);
  }
});

test("Instructor creates courses and manages only teaching assignments", () => {
  const instructor = { id: 12, role: "Instructor" };
  assert.equal(canCreateCourse(instructor), true);
  assert.equal(canManageCourse(instructor, { instructorId: 12 }), true);
  assert.equal(canManageCourse(instructor, { instructorId: 99, staffId: 12 }), false);
  assert.equal(canManageCourse(instructor, { instructorId: null }), false);
  assert.equal(canManageCourse(instructor, null), false);
  assert.equal(canAccessPage(instructor, "my-courses"), true);
  assert.equal(canAccessPage(instructor, "enrollments"), true);
  assert.equal(canAccessPage(instructor, "users"), false);
  assert.equal(canAccessPage(instructor, "progress"), false);
  assert.deepEqual(directoryRoles(instructor), []);
  assert.equal(canResetPassword(instructor, { role: "User" }), false);
});

test("anonymous and unknown roles cannot access private screens", () => {
  for (const actor of [
    null,
    { role: "Unknown" },
    { role: "__proto__" },
    { role: "toString" },
  ]) {
    assert.equal(canAccessPage(actor, "courses"), true);
    for (const page of [
      "profile",
      "permissions",
      "users",
      "progress",
      "lesson",
    ])
      assert.equal(canAccessPage(actor, page), false);
    assert.deepEqual(directoryRoles(actor), []);
    assert.equal(hasPermission(actor, "roles.manage"), false);
  }
});
