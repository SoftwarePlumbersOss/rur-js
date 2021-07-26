# Rossum's Universal Reducer

## Status

RUR is in an early alpha state.

## Aims

Rossum's Universal Reducer (RUR) aims to provide an easy-to-user reducer for a Redux application which handles many common tasks in a standardized way.
This may fly somewhat in the face of the conventional wisdom that Redux reducers should handle application specific events. Our ambition is to provide
a rapid path to developing moderately data-centric apps, easing the burden of integrating your redux store with back-end services and providing
out-of-the-box solutions to common issues surrounding error handling, form initialization, responsive searches, and the orchestration of multiple back end
data services.

## Concepts

### Configuration by exception

RUR does not require you to write a reducer (it has a universal reducer built-in). Behavior of the reducer is controlled by some simple configuration.
For example: 

```javascript
const config = { type: DataType.RECORDSET };
getRegistry(Accessor).register("users", new BaseAccessor(config, ['users']));
```

Is enough to create a 'users' reducer which will hold information about multiple users (because we specified the type as a RECORDSET). The 
configuration can be expanded to include specifications for fields, field groups, validations, and so on, but none of this is actually 
required; by default fields are optional and unvalidated and any name can be used for a field. Wherever possible, sensible defaults 
have been defined.

### Recomposable reads and updates

The RUR data model is comprised of searchable/sortable Recordsets, Forms, Fields, and Field Groups. This data is stored in a redux Store. Every
effort is made to keep the data representation in the store as simple and uncluttered as possible.

Developers do not interact directly with these models however. Application code instead uses an 'Accessor', which provides a convenient and
_recomposable_ way to access and update this data. Given an accessor object and the redux state:-

```javascript
accessor.get(state, 'stepOne', 'user', 'firstName'); 
accessor.get(state).get('stepOne').get('user').get('firstName');
accessor.get('stepOne').get('user').get('firstName').get(state); 
```

will all return the exact same information. When it comes to updating this data:

```javascript
dispatch(accessor.set('Jonathan', 'stepOne','user','firstName'))
dispatch(accessor.get('stepOne').set('Jonathan','user','firstName'))
dispatch(accessor.get('stepOne').get('user').set('Jonathan','firstName'))
```

will all dispatch the same action, which will update stepOne.user.firstName to 'Jonathan'. These examples may seem trivial, but this may be
because we in the mutable default world of javascript we are used to the idea that:

```javascript 
stepOne.user.firstName = 'Jonathan';
```

and

```javascript
const a = stepOne.user;
a.firstName = 'Jonathan';
```

...should do much the same thing. This ability to recompose an update operation on some nested value into a sequence of reads followed by a write
if very useful when we want (for example) to pass the user object to compound form control for update. In the world of redux, however, where objects
in the store are immutable (only ever replaced, not updated), this form of recomposition is much harder to achieve. 

Accessors allow a parent control to pass a subset of its own state to a child, **along with the actions required to update that state**, 
without the child control needing to know anything about the parent.

### Universal Metadata and Introspection

Metadata can be added to all fields, field groups, forms, and recordsets. Similarly to the
above, `accessor.getMetadata(state, 'stepOne', 'user', 'firstName', 'error')` will get any
error associated with the given field. This operation can also be recomposed:

```javascript
accessor.get(state).get('stepOne').get('user').get('firstName').getMetadata('error');
accessor.get('stepOne').get('user').get('firstName').getMetadata(state,'error'); 
```

Information about what can be retrieved from a node is always available via recomposable operations
just like the above:

````javascript 
accessor.get(state,'stepOne').keys()       // an iterable over valid keys within 'stepOne'
accessor.get(state,'stepOne').getConfig()  // get configuration related to 'stepOne'
````

RUR provides standard validations which provide feedback via the metadata mechanism, so

```javascript
dispatch(accessor.get('stepOne','user','firstName').validate()); // may create an error
accessor.get(state,'stepOne','user').get('firstName').getMetadata('error'); // find the error
```

### Customisation via Delegation

An accessor may be simply customised. For example:

```javascript
function calculator(get, ...path) {
    if (path.equals("fullName")) return get("firstName")+" "+get("lastName");
}

const config = { type: DataType.RECORDSET };
const accessor = new BaseAccessor(config, [users]).addCalculatedFields(calculator);
getRegistry(Accessor).register("users", accessor);
```

Will create an accessor with a calculated 'fullName' field based on the 'firstName' and 'lastName'
fields stored in the underlying redux store. 

Similarly,

```javascript
function validator(datum, field) {
    if (field.equals("email") && !String(datum).includes("@")) return {
        error: { code: ErrorCode.STATE_VALIDATION, message: 'please input a valid email address' }
    }
}

const config = { type: DataType.RECORDSET };
const accessor = new BaseAccessor(config, [users]).addValidation(validator);
getRegistry(Accessor).register("users", accessor);
```

Will add a custom validation to the accessor which ensures any value in the 'email' field at least includes
an @ sign.

### Datasources and Forms

RUR integrates with back-end services via a Datasource together with an appropriate driver. The core RUR 
project provides an out-of-the-box driver which stores information in browser-local storage (indexedDB).
Subprojects are underway to support various cloud datastores, notably including Google firestore. The Driver
component is however designed to be easy to implement and developing a Driver for any REST API should be
reasonably straightforward.

Datasources are agnostic about technology and data formats but opinionated about lifecycle. Data is 
retrieved from a datastore during a search and written to a reducer. Data is written back to the
datastore when certain UI events occur (for example clicking on an 'OK' button). Such updates are 
always performed at the level of an entire document or record. 

* A Datasource is an Accessor for which update operations are only valid on first-level objects. So,
  `datasource.set({ firstName: 'Jonathan', lastName: 'Essex'}, 'testy.mctester@test.io')` is a valid
  operation on a datasource, but `datasource.set('Jonathan', 'testy.mctester@test.io', 'firstName')` 
  is not.
* A Datasource may be directly wired to a UI control for read-only access
* When updating, a record from a Datasource will typically be copied into a Form (a separate accessor)
  and then copied back to the datasource when the update is complete.
* Datasource actions are all asynchronous (implemented using redux-thunk)
* A Form is an Accessor which provides two additional actions - 'submit' and 'cancel'. RUR provides
  default behaviors for these actions via the Navigation component described below.

### Navigation and Workflow

The use of react router (where the application URL is an important part of application state) within a
redux application can cause problems unless best practice is followed. RUR attempts to enforce good practice. 
All actions required to update state are performed _before_ the URL is updated to display a new set of
components.

RUR introduces the concept of a 'data path' to the application, and ensures that all data on the current
data path is loaded. Some examples of simple data paths:

* `/users/jonathan` Where 'users' is the name of a Datasource and 'jonathan' is the id of a record within it. 
* `/users/jonathan/primaryGroup` Where 'primaryGroup' is a reference in the 'user' record to the 'groups' 
   accessor which relates the user to a specific group. 
* `/groups/admin/members` Where 'groups' is a datasource, 'admin' is the id of a record within it, and 
   'members' is the name of a one-to-many relation within the 'group' record which links a group to multiple
   users.

The `Navigator` component provided by RUR has a similar API to the standard 'history' component and can
be used to set the application path in exactly the same way. However, the Navigator component will also
ensure that any data specified on the new data path is loaded *before* changing the application path 
and thus updating the UI.

By default, the data path is the same as the application path; therefore all one needs to do is register
a datasource called (for example) `users` in order to make sure that any UI components which are routed to
render on `/users/:id` will have access to the user data for the specified id. The navigator component can however
be configured to perform a mapping between the application path and the data path. For example:

```
    const users = getRegistry(Datasource).resolve('users');
    getBrowserNavigator().configure(
        ['/players/:id', [ users, 'id' ]],
        ['/users' : null]
    });
```

Will suppress the default mapping of the `/users` path and instead map the application path `/players/`_id_ to 
the data path `/users/`_id_. This would ensure that (for example) a UI component which is rendered on the application
path `/players/:id/editor` can assume that the relevant user data will have been loaded from the back-end data store
_before_ the UI component is rendered.

A form may also appear in the data path. Data from the preceeding element in the data path will be loaded into
the form. The 'submit' action for the form will, by default, validate the entire form, and if there is no error,
save the data back to the first datasource preceeding the form in the data path. If the save operation completes
successfully, the 'submit' action will then issue a navigator 'pop' action to return the user to the page which
was open prior to navigating to the form. The 'cancel' action for the form will perform the 'pop' action without
validating or saving the data. Some simple paths including forms:

*  `/users/jonathan/userEditor` Will copy the record 'jonathan' from the 'users' datasource into the 'userEditor'
   form. The form's submit action will write data back to the same record/datasource.
*  `/users/userEditor` Will clear any existing data from the userEditor form. The form's submit action will write
   a new record in the 'users' datasource.
   
As above, the mapping between the application path and the data path can be customised to inject forms without
specifically referencing them on the path. The following snippet:

```
    const users = getRegistry(Datasource).resolve('users');
    const editForm = getRegistry(Form).resolve('userEditor');

    getBrowserNavigator().configure(
        ['/players/:id', [ users, 'id', editForm ]],
        ['/users' : null]
    });
```

Would map the application path `/players/`_id_ to the data path `/users/`_id_`/userEditor`.

