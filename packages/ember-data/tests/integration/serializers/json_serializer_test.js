var get = Ember.get, set = Ember.set;
var Post, post, Comment, comment, Favourite, favourite, env;

module("integration/serializer/json - JSONSerializer", {
  setup: function() {
    Post = DS.Model.extend({
      title: DS.attr('string'),
      comments: DS.hasMany('comment', {inverse:null})
    });
    Comment = DS.Model.extend({
      body: DS.attr('string'),
      post: DS.belongsTo('post')
    });
    Favourite = DS.Model.extend({
      post: DS.belongsTo('post', { polymorphic: true, async: true })
    });
    env = setupStore({
      post:     Post,
      comment:  Comment,
      favourite: Favourite
    });
    env.store.modelFor('post');
    env.store.modelFor('comment');
    env.store.modelFor('favourite');
  },

  teardown: function() {
    env.store.destroy();
  }
});

test("serializeAttribute", function() {
  post = env.store.createRecord("post", { title: "Rails is omakase"});
  var json = {};

  env.serializer.serializeAttribute(post, json, "title", {type: "string"});

  deepEqual(json, {
    title: "Rails is omakase"
  });
});

test("serializeAttribute respects keyForAttribute", function() {
  env.container.register('serializer:post', DS.JSONSerializer.extend({
    keyForAttribute: function(key) {
      return key.toUpperCase();
    }
  }));

  post = env.store.createRecord("post", { title: "Rails is omakase"});
  var json = {};

  env.container.lookup("serializer:post").serializeAttribute(post, json, "title", {type: "string"});


  deepEqual(json, {
    TITLE: "Rails is omakase"
  });
});

test("serializeBelongsTo", function() {
  post = env.store.createRecord(Post, { title: "Rails is omakase", id: "1"});
  comment = env.store.createRecord(Comment, { body: "Omakase is delicious", post: post});
  var json = {};

  env.serializer.serializeBelongsTo(comment, json, {key: "post", options: {}});

  deepEqual(json, {
    post: "1"
  });
});

test("serializeBelongsTo with null", function() {
  comment = env.store.createRecord(Comment, { body: "Omakase is delicious", post: null});
  var json = {};

  env.serializer.serializeBelongsTo(comment, json, {key: "post", options: {}});

  deepEqual(json, {
    post: null
  }, "Can set a belongsTo to a null value");
});

test("serializeBelongsTo respects keyForRelationship", function() {
  env.container.register('serializer:post', DS.JSONSerializer.extend({
    keyForRelationship: function(key, type) {
      return key.toUpperCase();
    }
  }));
  post = env.store.createRecord(Post, { title: "Rails is omakase", id: "1"});
  comment = env.store.createRecord(Comment, { body: "Omakase is delicious", post: post});
  var json = {};

  env.container.lookup("serializer:post").serializeBelongsTo(comment, json, {key: "post", options: {}});

  deepEqual(json, {
    POST: "1"
  });
});

test("serializeHasMany respects keyForRelationship", function() {
  env.container.register('serializer:post', DS.JSONSerializer.extend({
    keyForRelationship: function(key, type) {
      return key.toUpperCase();
    }
  }));
  post = env.store.createRecord(Post, { title: "Rails is omakase", id: "1"});
  comment = env.store.createRecord(Comment, { body: "Omakase is delicious", post: post, id: "1"});
  var json = {};

  env.container.lookup("serializer:post").serializeHasMany(post, json, {key: "comments", options: {}});

  deepEqual(json, {
    COMMENTS: ["1"]
  });
});

test('serializeBelongsTo with async polymorphic', function() {
  var json = {},
      expectedJSON = { post: '1', postTYPE: 'post' };

  env.container.register('serializer:favourite', DS.JSONSerializer.extend({
    serializePolymorphicType: function(record, json, relationship) {
      var key = relationship.key;
      json[relationship.key + 'TYPE'] = record.constructor.typeKey;
    }
  }));

  post = env.store.createRecord(Post, { title: 'Kitties are omakase', id: '1' });
  favourite = env.store.createRecord(Favourite, { post: post, id: '3' });

  env.container.lookup('serializer:favourite').serializeBelongsTo(favourite, json, { key: 'post', options: { polymorphic: true, async: true } }).then(function(json) {
    deepEqual(
      json,
      expectedJSON,
      'Expected: ' + JSON.stringify(expectedJSON) + ', Got: ' + JSON.stringify(json)
    );
  });
});

test("serializePolymorphicType", function() {
  env.container.register('serializer:comment', DS.JSONSerializer.extend({
    serializePolymorphicType: function(record, json, relationship) {
      var key = relationship.key;
      json[relationship.key + "TYPE"] = record.constructor.typeKey;
    }
  }));

  post = env.store.createRecord(Post, { title: "Rails is omakase", id: "1"});
  comment = env.store.createRecord(Comment, { body: "Omakase is delicious", post: post});
  var json = {};

  env.container.lookup("serializer:comment").serializeBelongsTo(comment, json, {key: "post", options: { polymorphic: true}});

  deepEqual(json, {
    post: "1",
    postTYPE: "post"
  });
});

test("extractArray normalizes each record in the array", function() {
  var postNormalizeCount = 0;
  var posts = [
    { title: "Rails is omakase"},
    { title: "Another Post"}
  ];

  env.container.register('serializer:post', DS.JSONSerializer.extend({
    normalize: function () {
      postNormalizeCount++;
      return this._super.apply(this, arguments);
    }
  }));

  env.container.lookup("serializer:post").extractArray(env.store, Post, posts);
  equal(postNormalizeCount, 2, "two posts are normalized");
});

test('Serializer should respect the attrs hash when extracting records', function(){
  env.container.register("serializer:post", DS.JSONSerializer.extend({
    attrs: {
      title: "title_payload_key"
    }
  }));

  var jsonHash = {
    title_payload_key: "Rails is omakase"
  };

  var post = env.container.lookup("serializer:post").extractSingle(env.store, Post, jsonHash);

  equal(post.title, "Rails is omakase");
});

test('Serializer should respect the attrs hash when serializing records', function(){
  env.container.register("serializer:post", DS.JSONSerializer.extend({
    attrs: {
      title: "title_payload_key"
    }
  }));

  post = env.store.createRecord("post", { title: "Rails is omakase"});

  Ember.run(function() {
    env.container.lookup("serializer:post").serialize(post).then(function(payload) {
      equal(payload.title_payload_key, "Rails is omakase");
    });
  });
});

test("Serializer should respect the primaryKey attribute when extracting records", function() {
  env.container.register('serializer:post', DS.JSONSerializer.extend({
    primaryKey: '_ID_'
  }));

  var jsonHash = { "_ID_": 1, title: "Rails is omakase"};

  post = env.container.lookup("serializer:post").extractSingle(env.store, Post, jsonHash);

  equal(post.id, "1");
  equal(post.title, "Rails is omakase");
});

test("Serializer should respect the primaryKey attribute when serializing records", function() {
  env.container.register('serializer:post', DS.JSONSerializer.extend({
    primaryKey: '_ID_'
  }));

  post = env.store.createRecord("post", { id: "1", title: "Rails is omakase"});

  Ember.run(function() {
    env.container.lookup("serializer:post").serialize(post, {includeId: true}).then(function(payload) {
      equal(payload._ID_, "1");
    });
  });
});
