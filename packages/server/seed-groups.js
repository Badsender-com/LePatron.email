const mongoose = require('mongoose');
const faker = require('faker');
const Roles= require('./account/roles.js');
const { Users, Groups, Mailings, Templates } = require('./common/models.common.js');
const groupService = require('./group/group.service.js');

mongoose.connect('mongodb://localhost:27017/lepatron', {
  useNewUrlParser: true
});

module.exports.seed = async function() {

  const groupsLimit = 100;
  const usersLimit = 50;
  const emailsLimit = 5;

  for (let i = 0; i < groupsLimit; i++) {
    let groupName = faker.name.findName();

    // if group name is already taken, generate a new one
    while (await Groups.exists({ name: groupName} )) {
      groupName = faker.name.findName();
    }

    const group = await Groups.create({
      name: groupName,
    });

    // if groupName is not taken amongst groups, there's a high likelihood it's not taken amongst templates
    let templateName = groupName;
    while (await Templates.exists({ name: templateName })) {
      templateName = faker.name.findName();
    }

    const template = await Templates.create({
      name: templateName,
      _company: group._id
    })

    for (let j = 0; j < usersLimit; j++) {
      let userEmail = faker.internet.email();

      // if user email is already taken, generate a new one
      while (await Users.exists({ email: userEmail })) {
        userEmail = faker.internet.email();
      }

      const user = await  Users.create({
        name: faker.name.findName(),
        email: userEmail,
        role: Roles.REGULAR_USER,
        _company: mongoose.Types.ObjectId(group._id)
      });

      for (let k = 0; k < emailsLimit; k++) {
        await Mailings.create({
          name: `email ${k} of ${user.name}`,
          _user: user._id,
          _company: group._id,
          _wireframe: mongoose.Types.ObjectId(template._id)
        });
      }
    }

  }

  // after this operation, every single group should have a workspace
  // all its users and mailings should be part of
  const alteredCompanies = await groupService.seedGroups();

  // should be equal to usersLimit
  console.log({ numberOfAlteredCompanies: alteredCompanies.length });
};
